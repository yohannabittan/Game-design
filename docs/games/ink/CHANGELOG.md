# Ink changelog

## v0.1 (unreleased)
- Created from skeleton.
- Layer 1 (mechanic), built by Sonnet: hold-and-move needle with the constant screen-pixel offset, distance-sampled coverage grid and once-per-exit slips, circle stencil with a 30 s timer, HUD, card, menu, best percentage saved. Open questions: ink drawn as smooth strokes with the grid only for scoring (clipped to the stencil so the two agree), stencil 1 timer generous so five stars is reachable. The timer starts on the first touch down.
- Layer 1 review fixes, Sonnet: card shows Next on a pass or Again on a fail (never both) plus a Menu button, slips are also tested at the real needle position of each event, a lost pointer up no longer locks out inking, and the timer is now larger than the slip counter.
- Layer 2 progression, Sonnet: unlock by one star, best percentage, stars and clean per stencil (saveVersion 2 with migrate from v1), select grid of 10 tiles, total stars on the menu, Next goes to the next stencil and stencil 10's pass card shows Menu; ink cached on an offscreen layer; stencils 2 to 10 are placeholders pending the content shards; tools/sim-ink.mjs added.
- Layer 2 content (Sonnet shards, sequence review found two timer errors by the orchestrator, fixed): nine stencils authored by three parallel Sonnet shards against tools/sim-ink.mjs and merged by the orchestrator (ADR-0012); timers set as a multiple of the perfect-path time; every stencil reaches 99 percent clean by its intended path and a naive sweep is ruined on each.
