# Ink changelog

## v0.1 (unreleased)
- Created from skeleton.
- Layer 1 (mechanic), built by Sonnet: hold-and-move needle with the constant screen-pixel offset, distance-sampled coverage grid and once-per-exit slips, circle stencil with a 30 s timer, HUD, card, menu, best percentage saved. Open questions: ink drawn as smooth strokes with the grid only for scoring (clipped to the stencil so the two agree), stencil 1 timer generous so five stars is reachable. The timer starts on the first touch down.
- Layer 1 review fixes, Sonnet: card shows Next on a pass or Again on a fail (never both) plus a Menu button, slips are also tested at the real needle position of each event, a lost pointer up no longer locks out inking, and the timer is now larger than the slip counter.
