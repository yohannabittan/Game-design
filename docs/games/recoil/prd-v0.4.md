# Recoil PRD v0.4: the fifth rungs and Boss 2

Status: locked 2026-09-29 (overnight). Builds on v0.3 (cache recoil-v8). Scope is content and missions only: no new guns, no change to handling, scoring rules or the unlock table.

## Goal

The designer's ladder design is five rungs per ladder. v0.3 ships four on Accuracy and Speed, two on Skeet and one Boss. v0.4 adds the missing top rungs and gives the marksman rifle the challenge where it is the best tool, which the v0.2 review asked for.

## A. New challenges

| Id | Name | Unlock | What it is | Skill it tests |
| --- | --- | --- | --- | --- |
| a5 | Accuracy 5 | Accuracy 4 at two stars | Small far targets (scale at most 0.8) that dodge and, every third target, appear for a fixed short window then flip away; a miss on a flipped target costs nothing but the window | Sway control and the timing of the first shot |
| s5 | Speed 5 | Speed 4 at two stars | Two hordes back to back with a weaving pair between them, a tighter timer than Speed 4 by the perfect-path rule (design-principles) | Burst discipline: fire interval under kick recovery means holding fire climbs off the horde |
| k3 | Skeet 3 | Skeet 2 at two stars | Three launches per volley from alternating sides, one of them a decoy in the player's own orange that scores minus its zone value if hit; goal clays stay cyan | Target discrimination under speed |
| b2 | Boss 2 | Boss 1 at two stars and the rifle unlocked | "Bunker": a wide plate wall with six 3-hp plates, each in a bolted frame, that reveal in a seeded order two at a time; behind them a core with a bullseye that is only exposed while at least four plates are down. Timer per the boss rule | Damage per shot: the rifle one-shots a plate, the pistol needs three centred hits, the shotgun needs its centre pellet plus two outers on the same plate |

Rules that carry over unchanged: a plate takes damage only while active (no inactive-part farming); the bullseye dot is never red; nothing spawns in the thumb lane; determinism at 30 and 120 fps; every challenge has Menu on its card.

Boss 2 thresholds are per gun, set the same way as Boss 1 after the v0.3 F amendment: each gun's maximum over centred shots in the simulator, then 30/55/85 percent, so perfect centred play always earns three stars. The rifle's three-star threshold must not be reachable by the pistol at its own maximum, or the rifle has no niche; if the search shows it is, plate hp goes to 4 (a tuning change, note it in the changelog).

## B. Missions

| Tier | Badge | Earned by | Skin |
| --- | --- | --- | --- |
| Silver | Marksman II | three stars on Accuracy 5 | none |
| Silver | Quick Draw II | three stars on Speed 5 | none |
| Silver | Clay II | Skeet 3 with no decoy hit and three stars | none |
| Gold | Sniper | Boss 2 three stars with the rifle | Rifle "Bronze" (a warm bronze palette with an engraved plate on the receiver) |

Existing badges keep their conditions. Legend already reads "three stars on every challenge", so it now includes the four new ones; a Legend already earned is never revoked (badges are never removed by a later version). The gauntlet chain stays a2, s2, k2, b1. The missions screen shows the new badges in their tiers and must still fit 640x360 in landscape and the portrait fallback; if the tiles run out of room, the screen scrolls by drag with a 44 px scroll affordance rather than shrinking text under 14 px.

## C. Save

Bests are keyed by challenge id, so no remap is needed. Add nothing to the save shape unless the scroll position or the decoy count needs it; if it does, bump `saveVersion` to 6 with a `migrate` that keeps everything.

## D. Tuning additions

All in `TUNING` or the challenge entries: plate hp, plate reveal interval, decoy penalty, flip window. Star thresholds live on the challenge as before, per gun on Boss 2.

## E. Out of scope

New guns, handling changes, new skins beyond Bronze, a second gauntlet, sound changes. The rifle's damage stays 3.

## Amendment after the build (2026-09-29, late)

The rifle-niche rule in section A ("the rifle's three-star must be out of the pistol's reach") cannot hold under per-shot scoring: the gun that fires more shots always out-scores a stronger one (pistol centred maximum 9750 in 27 shots, rifle 2550 in 9). Plate hp 4 makes it worse and ends the rifle's one-shot plates. Plate hp stays 3 and stars are per gun from centred maxima. The rifle's niche in v0.4 is therefore the one-shot plate, the shortest perfect path (10.7 s against the pistol's 14.9 s) and the rifle-gated Sniper badge, not a score the pistol cannot match. Whether that is enough is the designer's call; it is experiment REC-4 in docs/plans/2026-09-30-experiments.md. If not, the v0.5 answer is a scoring rule that pays per plate rather than per hit, or a Boss 2 timer set from the rifle's path.
