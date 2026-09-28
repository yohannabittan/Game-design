# Gravity Golf changelog

## v0.1 (unreleased)
- Created from skeleton.
- Layer 1 (mechanic) built by Sonnet 5.5, passed review first time with four low-severity fixes (below): slingshot aim with occlusion rule, fixed 1/120 s physics shared by flight and preview, hole 1, strokes and par HUD, hole card with stars and best, menu with Play and mute; walls, bumpers, wells and mover are supported by the physics but only hole 1 is authored. Open questions resolved: preview simulates the real physics (wells and bounces included); the hole ring brightens while the ball is moving slower than sinkSpeed. Interpretation: out of bounds adds oobPenalty on top of the shot's own stroke.
- Layer 1 review fixes (Sonnet 5.5): hole 1 rebuilt so a near-straight shot at 30 to 70 px sinks over a 6.9 degree window (dead-straight now clears the wall; only aims more than about 3 degrees left clip it); `speedMax` clamp and `keyPowerStart` added to TUNING; `hit` plays at volume 0.3; pointercancel cancels the aim; Space no longer throws in the dead zone; saveVersion 2 with `migrate` dropping a non-object `best`.
