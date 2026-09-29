# Ink PRD v0.6: the timer you can see, the slip you can feel, and stencils in parts

Status: locked 2026-09-29 (morning) for sections A, B and D. Section C waits on one designer answer. Builds on v0.5 (cache ink-v16). Source: the designer's playtest notes.

## A. Timer prominence

The timer is the largest thing on the HUD: a big numeral centred at the top under the safe inset, cream, shifting to amber under a third of the time and pulsing under five seconds, with a thin ring around it draining clockwise. It never sits under the thumb. Percent inked moves beside it, smaller.

## B. Slip feedback

On a slip: the body flinches (the skin layer jolts 3 units away from the needle and settles in 0.25 s), the screen kicks once (2 px, 80 ms), the slip sound gets a low thud, and the phone buzzes 20 ms through the engine's existing haptic call (Android; iPhone Safari has no vibration, so the visual carries it). One flinch per slip, never stacking. The slip mark itself is unchanged.

## C. Body background (needs one answer: practice pad, or flattened body parts)

Option 1, practice pad: a synthetic tattoo practice skin, a pale rectangular pad on a tray with the machine beside it; one skin tone, a soft grain, no body silhouette. Every stencil uses it; body parts return later as an unlock. Option 2, flattened parts: keep the body parts but one flat tone, softer shading, no lumpy edges, and a cleaner drape. The fixed style sentence is updated to match the choice.

## D. Stencils in parts and landings

A stencil may have two or more separate parts. Inking a part to 99 percent completes it; the piece is done when every part is. Lifting the needle is free. Landing is scored: a touch-down inside a part's line is a clean landing; a touch-down on skin outside every line is a blot (a slip with its own mark). The card counts landings and clean landings; a "Steady Landing" badge (Artist tier) for a piece with every landing clean and a "Set Piece" badge (Master) for five stars on every multi-part stencil. Content: the skull gains separate teeth, the swallow becomes two wings and a body, and three new sets are added by shards under the timer rule (perfect path measured across parts including the lifts): Trinity (three rings), Constellation (five small stars joined by nothing), Bones (two crossed bones). Timers use the perfect path with the lifts included. The simulator gains lifts in paths (a null entry) and reports landings.

## E. Tuning and save

Flinch amplitude and time, screen kick, blot radius, landing tolerance in TUNING. Save v8 adds landing counts per stencil; migrate keeps everything.

## F. Out of scope

New machines, ink physics changes, the daily's rules.
