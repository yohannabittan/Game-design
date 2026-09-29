# Recoil PRD v0.5: stars a thumb can earn, a range that reads, and more to shoot

Status: locked 2026-09-29 (morning), all sections. Builds on v0.4 (cache recoil-v10). Source: the designer's first full playtest. Findings: stars and scores are too hard; Accuracy targets sometimes vanish or do not score; Speed and Skeet are the fun; guns feel distinct; the rifle on Speed was a fun wrong tool; the menu is dull; guns should show stats; skins read as uneven; the game wants more umph.

## A. Star bars from noisy bots

Rule change. Star thresholds no longer come from a perfect-aim bot. Every challenge's three bars are the mean scores of bots with Gaussian aim noise, run over 100 seeds with the challenge's best-suited gun: one star at 3.0 degrees, two stars at 1.5 degrees, three stars at 0.75 degrees. Per-gun bars where they exist (bosses) use the same noise per gun. Timers are unchanged. The three levels are exposed on TUNE as presets: Pro (0.5 / 1.0 / 2.0 degrees), Skilled (the rule: 0.75 / 1.5 / 3.0), Casual (1.0 / 2.0 / 4.0), with the noise triple as three sliders, so the designer can feel which bar makes three stars an achievement. Stars already saved are kept (never revoked); the star shown for a saved best is recomputed against the active bars.

## B. Accuracy targets that never cheat

Per the investigation (docs/games/recoil/playtests/2026-09-29-accuracy-glitch.md when written): a shot that visibly lands on a live target always scores, and no target leaves the field without a cue. Minimum rules: a target that times out shows a fade and a "gone" pop; a dodger's hit test uses its drawn position on the frame of the shot; a flip target's turn is telegraphed with a ring and an edge-on target is not hit-testable until it has turned back; a dropped tap (fire-rate gate) shows the cue every time; a slide of a thumb under 6 px counts as a tap.

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
