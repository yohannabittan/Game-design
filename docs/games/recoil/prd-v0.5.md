# Recoil PRD v0.5: stars a thumb can earn, a range that reads, and more to shoot

Status: locked 2026-09-29 (morning), all sections. Builds on v0.4 (cache recoil-v10). Source: the designer's first full playtest. Findings: stars and scores are too hard; Accuracy targets sometimes vanish or do not score; Speed and Skeet are the fun; guns feel distinct; the rifle on Speed was a fun wrong tool; the menu is dull; guns should show stats; skins read as uneven; the game wants more umph.

## A. Star bars from noisy bots

Rule change. Star thresholds no longer come from a perfect-aim bot. Every challenge's three bars are the mean scores of bots with Gaussian aim noise, run over 100 seeds with the challenge's best-suited gun: one star at 3.0 degrees, two stars at 1.5 degrees, three stars at 0.75 degrees. Per-gun bars where they exist (bosses) use the same noise per gun. Timers are unchanged. The three levels are exposed on TUNE as presets: Pro (0.5 / 1.0 / 2.0 degrees), Skilled (the rule: 0.75 / 1.5 / 3.0), Casual (1.0 / 2.0 / 4.0), with the noise triple as three sliders, so the designer can feel which bar makes three stars an achievement. Stars already saved are kept (never revoked); the star shown for a saved best is recomputed against the active bars.

## B. Accuracy targets that never cheat (amended 2026-09-30 after the investigation)

Per docs/games/recoil/playtests/2026-09-29-accuracy-glitch.md: a shot that visibly lands on a live target always scores, and no target leaves the field without a cue. Rules: F1 dodge legibility (call-out, ghost, slide, steady armed ring and cooldown arc, an intro line on Accuracy 4 and 5; the dodge mechanic, rule and ammo unchanged); F2 a 0.12 s expiry grace with a fade, a "Gone" pop, a buzz and "Chain lost", the ring orange and pulsing in the last second; F3 a visible dropped-tap cue (finder flash, full-volume click, haptic); F4 the Reload button falls through to fire when there is nothing to reload; F5 a "centre pellet scores" pop for shotgun outer pellets on a card; F6 flip targets stay hit-testable until removal (the earlier edge-on line is withdrawn); F7 the drawn paper scores (hit radius grows by the card pad, Accuracy bars regenerated); F8 a "Run restarted" toast after backgrounding.

## C. Gun stats and skins on the menu

Each gun tile opens to a stats card: damage, fire rate, accuracy (finder length), kick, recovery and magazine as bars against the four-gun maximum, one line of text on its job ("one-shots plates", "hordes and clays"), and its skin swatches with the badge each needs. All four guns show their swatches, locked or not, so skins read as symmetric. The card opens from a tap on the tile's info corner and closes with Back; the tile itself still selects the gun.

## D. Score you can see

A combo multiplier drawn beside the crosshair lane: it climbs a step per consecutive bullseye (x1 to x5), snaps to x1 on a miss, and each step raises the hit sound's pitch. Streak call-outs on the field ("Double", "Triple", "Clean sweep") in the goal colour, and a slow-motion last kill on Speed and Skeet (0.4 s at quarter speed). The card counts up the score in a ticker. Nothing here changes scoring; the multiplier draws the combo that already exists.

## E. Wrong Tool missions

Silver badges for finishing a challenge with the gun it was not designed for, each unlocking nothing but the badge: Rifle on Speed 3 at two stars ("Marksman's Sprint"), Shotgun on Accuracy 2 at two stars ("Scatter Precision"), Pistol on Boss 2 at two stars ("Sidearm Only"), Carbine on Skeet 2 at three stars ("Clay Carbine"). Data only.

## F. Menu as a range

The ladder grid becomes lanes on the range: each ladder is a row of targets standing on posts, one per rung, drawn as the rung's own target type (cards, trolleys, clays, plates), with stars painted on the post and the best gun's silhouette below. The next locked rung shows its condition on a hanging tag. A featured tile at the right end shows the newest mode (Zombies when built) or the daily. The layout must fit 640x360 and 844x390 with 44 px targets and text at least 14 px, and portrait stays the fallback.

## G. Zombies (designer: a walker reaching the fence ends the run)

A zombie is a moving target with three parts: legs (2 hp), body (3 hp), brain (1 hp, small). It walks toward a fence line at the near edge. Legs down and it crawls at half speed and lower to the ground. Body down slows it. Only the brain ends it. Waves of two to six with mixed speeds, seeded; an endless mode with a daily seed and a high score; a "Zombies" ladder of three rungs (fixed waves) for stars. Guns: the shotgun's pellets each damage a part (legs and hordes), the rifle one-shots a brain at range, the pistol is the all-rounder. Score per part plus a brain bonus, multiplier applies. Fence rule: the run ends the moment a zombie touches the fence; the card says which one and how far the wave got. A fence with hit points is a later option.

## H. Two more guns (needs no answer, held with G for one build)

SMG: damage 1, fireRate 14, accuracy 0.5, kick 6, recovery 40, mag 24; hardest climb when held. Revolver: damage 3, fireRate 1.2, accuracy 1.0, kick 20, recovery 18, mag 6; one-shots plates and brains. Both unlocked by badges (SMG by Quick Draw II, Revolver by Marksman II), each with a default skin and two badge skins. Fire interval under recovery on both.

## I. Save and out of scope

Save v6: adds the active star-bar preset name and nothing else; bests keyed by id are untouched. Out of scope: handling changes, new bosses, sound redesign.

## J. Delighter badges

Trick badges with a name and a reward feel, earned by a single act, never by grind:

| Badge | Earned by |
| --- | --- |
| Kickback | six hits in a row within 0.5 s, so the recoil itself walks the aim up the targets |
| Last Round | three stars with the magazine empty on the final shot |
| Cold Barrel | a bullseye on the first shot of a run, five runs in a row |
| Clay Sweep | every clay of a Skeet run hit before it peaks |
| Walk the Line | a horde cleared left to right without a miss |

Each shows on the missions screen with its condition and pops a ticket on the card.

## K. Per-gun progression (from the 2026-09-30 second session; build before F)

Finding: a boss best is saved without its gun, so the menu reads a rifle best against the pistol's bars and the rifle can never show three stars. Finding: the selector cannot tell the designer what they have done with which gun, which the badges depend on.

Rule change:

- Bests are keyed by challenge and gun: `bests[challengeId][gunId] = { score, stars, accuracy }`. Stars are per gun, against that gun's bars (every challenge gets per-gun bars from the section A bots, not only the bosses).
- Ladders unlock per gun: rung n+1 opens for a gun when that gun has two stars on rung n; Boss 2 opens for a gun with two stars on Boss 1. A new gun starts every ladder at rung 1.
- The menu shows the selected gun's progress: its stars on every rung, its locks, its best score on the selected rung, and the gun's silhouette by the ladders. Switching guns redraws the lanes.
- Points are the sum of every gun's stars. Gun unlocks move to badges: carbine by Marksman I, shotgun by Quick Draw I, rifle by Clay I (each is a bronze badge any pistol player earns early); the points table is retired.
- Badges read per-gun stars: Boss Killer, the Wrong Tool set, Sniper as before; Legend becomes three stars on every challenge with any gun; a new Gold badge "Arsenal" for three stars on every challenge with every gun.
- Migration (save v7): each old best becomes the pistol's entry, except boss bests where `bossGuns` names the gun; per-gun unlocks are derived from those entries; badges are never revoked; the star-bar preset is kept.
- Section B, D and A behaviours unchanged. The stats card (C) shows that gun's rung count ("9 of 15 rungs at two stars or better").

## L. Zombies v2 (from the 2026-09-30 third session)

Findings: brains all at one height made the mode too easy (no vertical aim); zombies too slow; hitting anything but the brain should break the multiplier; speed and health should climb over time.

- Types, each a data entry with head height, speed, part hp and a silhouette: Shambler (standard, head high-mid), Runner (1.6x speed, head bobbing by 20 units), Crawler (starts on the ground, brain low, 0.7x speed), Brute (tall, body 5 hp, head at the top of the field band, 0.8x speed), Hunched (head at chest height, the body shields the brain until the body is down). Four distinct brain heights across the set.
- Base speeds up by 1.4x. Fixed rungs mix at least three types from Zombies 2 on. Endless: every wave raises speed 4 percent and part hp by 1 every third wave, and the type mix widens with the wave number.
- Headshot chain: only a brain hit advances the multiplier; a legs or body hit keeps the multiplier (it does not step it) and a miss resets it. Amend: per the designer, a hit on anything but the brain resets the multiplier to x1. Legs and body still pay their points.
- Bars regenerated with the section A bots per gun for the three rungs; Endless keeps no stars.

## M. Reload (all modes)

Every gun has a magazine and a reload time. Empty triggers an automatic reload; a Reload button (44 px, above the fire zone on the right thumb's side) reloads early; a ring on the gun and a text cue show progress; firing during a reload does nothing and shows the dropped-tap cue.

| Gun | Magazine | Reload | Note |
| --- | --- | --- | --- |
| Pistol | 12 | 1.0 s | |
| Carbine | 30 | 1.6 s | |
| Shotgun | 6 | 2.2 s | shell by shell (0.37 s each), a fire tap interrupts and fires what is loaded |
| Rifle | 5 | 1.8 s | |
| SMG | 24 | 1.4 s | |
| Revolver | 6 | 2.4 s | |

Ammo per challenge stays as it is (Accuracy rungs keep their round counts; the magazine is how many can be fired before a reload). Perfect paths, timers and star bars are regenerated with reloads in; the report states, per rung, where the perfect path reloads. Reload time and magazine sizes are in TUNING. Ledger `result` gains `reloads`.

## N. Menu v2 and gun mastery (from the 2026-09-30 fourth session; build after M)

Findings: the level selector is busy, information everywhere; the little gun under a rung makes no sense; select a gun and see the levels you have with that gun; gun mastery unlocks skins; track headshots and bullseyes.

Menu v2, the gun is the context:
- Top: the gun rack, six tiles in one row. The selected gun is drawn larger with its name, mastery bar and worn skin; locked guns show only the badge that opens them. Tapping the selected tile opens the stats card; the separate "i" goes away.
- Below: the selected gun's lanes only. Each rung shows its target art, that gun's stars and a lock if closed. No best-gun silhouette, no hanging tags. One hint line under the lanes: the next thing this gun unlocks and how ("Accuracy 4: two stars on Accuracy 3").
- Corner buttons: Missions, Endless (with today's best), Sound. The engine's TUNE and EXPORT tabs stay where the engine puts them. Points move into the stats card and the missions screen.
- Everything at least 44 px and 14 px at 640x360 and 844x390; the first menu frame under 40 ms at 4x throttle.

Gun mastery:
- Per gun, lifetime counters in the save (v10): shots, hits, bullseyes (Accuracy and Skeet bullseyes, boss core bullseyes), headshots (zombie brains), plates. Ledger `result` lines already carry the per-run numbers; the counters are their sums.
- Tiers: Marksman at 100 bullseyes plus headshots, Expert at 500, Master at 1500 with lifetime accuracy at least 60 percent. The mastery bar on the rack shows progress to the next tier; the stats card shows the counters.
- Skins: each gun's second skin unlocks at Marksman and its third at Master (the Legend Gold pistol stays on Legend). Trick-badge skins (SMG Brass and Hazard, revolver Ivory and Frost) stay on their badges. The badge-to-skin table in v0.3 E is retired for the ladder badges; those badges keep their names and conditions and unlock nothing but themselves. Skins already earned are kept on migration (a worn skin is never taken away).
- Missions screen: badges only, no skin swatches; the skins picker lives on the stats card.
