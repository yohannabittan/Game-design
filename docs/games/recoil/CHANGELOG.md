# Recoil changelog

## v0.1 (unreleased)
- Created from skeleton.
- Layer 1 mechanic built by Sonnet (review pending): landscape 640x360, two thumbs, recoil rule, Accuracy 1-3 and Speed 1-3 with seeded targets, stars from 85/55/30 percent of the scripted perfect run, points and card. Section 17 choices: drag zone is the left half of the screen; Accuracy targets stay until `accLife` (a miss shot spends ammo but the target stays). Tuning change: `kickPerShot` 7 to 8, because at 7 two shots 0.1 s apart differ by 21.9 units at x = 400 (below the 24-unit acceptance check) and at 8 by 27.7. Additions outside the PRD: a Menu button in the HUD, Play on the menu picks the first unlocked challenge with no stars, a red left-edge flash when a target reaches the line.
