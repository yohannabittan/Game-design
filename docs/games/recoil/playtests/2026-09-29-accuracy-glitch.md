# Investigation: "accuracy targets glitch, do not score, disappear" (Recoil v10 report, checked on v17)

Method: a copy of game.js with an export hook, Chromium at 844x390 with touch input, taps timed against target state. Nothing in the report is taste.

## What the designer saw, ranked by likelihood

1. **Dodgers on Accuracy 4 and 5 are armed from spawn.** Any shot passing within 30 units of the centre makes the target jump 60 units before the hit test runs, so a dead-centre shot on an armed dodger never scores. No call-out, no ghost, no sound; the tracer passes through the old spot. The target also flickers at alpha 0.3 five times a second while armed, which reads as a rendering glitch.
2. **Targets time out in one frame** on every Accuracy rung (6 s, or 1.5 s for flip targets on Accuracy 5) with no fade, pop or sound, and the combo resets silently. A tap that lands 0 to 100 ms after the vanish burns a round and books a miss; touch latency is 50 to 100 ms.
3. **Dropped taps inside the fire interval have an invisible cue** (a 42 ms flash at alpha 0.3 and a click at volume 0.12). Pistol double-taps under 100 ms, rifle re-taps under 633 ms and shotgun re-taps under 413 ms do nothing visibly.
4. **Kick and latency:** the pistol recovers 0.53 degrees per frame; with 50 ms of latency a second tap lands 1.6 degrees (14 units at 500) below the drawn finder, nearly a full Accuracy 5 card. Physics, not a defect, but it needs the cues above to be legible.
5. **Shotgun outer pellets on a card score nothing** (centre-pellet rule) and the shot books a miss with no cue.
6. **The drawn card has 2 to 4 units of paper outside the hit radius** that does not score.
7. **v17 only:** the Reload button corner swallows a right-thumb tap when the magazine is full, with no cue.
8. Backgrounding the app restarts the run silently.

Not confirmed: stale target positions, a barrel angle from the previous frame, targets removed on a miss, a live-target cap, flip targets un-hit-testable edge-on (a centred shot on a squashed flip target scores).

## Fixes (PRD v0.5 section B, as amended)

F1 dodge legibility: "Dodged" call-out (not cyan), a ghost card at the old spot fading over 0.25 s, a draw-only 0.1 s slide, a soft sound; a steady dashed orange ring on an armed dodger at full alpha and a shrinking cooldown arc during the 1.2 s window, no flicker; a one-line intro on Accuracy 4 and 5 ("Fire near it and it jumps. Shoot again where it lands."). Mechanic, rule and ammo unchanged.
F2 expiry grace and cue: the target stays hit-testable for 0.12 s after life reaches zero while its card fades; the miss and removal book at the end of the grace unless a hit lands; a "Gone" pop, a low buzz on non-flip, "Chain lost" when a streak dies; the timer ring goes orange and pulses in the last second (last 30 percent on a flip target).
F3 dropped-tap cue: the range finder flashes white for 0.12 s, the click at normal volume, a 12 ms haptic.
F4 reload corner: a tap on the Reload button with a full magazine or during a reload falls through to fire.
F5 a dim "centre pellet scores" pop when an outer pellet crosses a card and the centre misses.
F6 the PRD's "edge-on not hit-testable" line is withdrawn; flip targets stay hit-testable until removal.
F7 the drawn paper scores: the card hit radius grows by the card pad (outer zone), Accuracy bars regenerated.
F8 backgrounding: toast "Run restarted" on return.
