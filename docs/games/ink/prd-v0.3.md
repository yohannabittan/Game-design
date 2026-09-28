# PRD v0.3: Ink (delta from v0.2)

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.3 |
| Date | 2026-09-28 |
| Status | locked as an experiment with presets |
| Answers | playtest 2026-09-28 (v0.2): "the size of the ink dot is critical; make it grow slower, not shrink too fast, with a minimum width, so it is less streaky and more fluid" |

Everything in `prd-v0.2.md` stands (dynamic needle, playtested values) unless changed here.

## A. Needle inertia

The needle's ink radius no longer jumps to the value the speed dictates. It moves toward that target with momentum:

- Target radius from speed as in v0.2 (`slowSpeed`, `fastSpeed`, `wideScale`, `thinScale`).
- The actual radius moves toward the target at `growRate` (radius units per second) while growing and at `shrinkRate` while shrinking. Growing is slower than shrinking by default, so holding still takes a moment to reach full width, and a quick move thins the line gradually rather than instantly.
- The radius never drops below `needleR * floorScale`, whatever the speed.
- Integrated in the fixed physics step, so it is frame-rate independent; path samples read the current radius. The drawn stroke follows the same radius, so the line visibly swells and tapers.
- Slip rule unchanged.

## B. Presets (tune panel)

| Preset | growRate | shrinkRate | floorScale | Feel |
| --- | --- | --- | --- | --- |
| Crisp | 60 | 80 | 0.65 | Close to v0.2: width follows speed almost instantly |
| Flowy | 14 | 30 | 0.8 | The designer's description: swells slowly, tapers gently, never thin |
| Heavy | 8 | 18 | 0.9 | Ink pools when you pause; lines stay fat; edges need real slowing |
| Marker | 25 | 25 | 0.75 | Symmetric, medium |

Sliders underneath: growRate (4 to 80), shrinkRate (4 to 100), floorScale (0.5 to 1.0), wideScale (1.0 to 2.5).

## C. Harness and verification

- `tools/sim-ink.mjs` integrates the radius over the path using each segment's speed, so `[x, y, speed]` paths give frame-rate-independent results; a `--preset NAME` flag applies a preset's values.
- [ ] Same path and speeds: same percentage at 30 and 120 event rates under each preset.
- [ ] Every stencil still reaches 99 percent clean by its dynamic intended path within its timer under Flowy; report per stencil under all four presets; if a preset pushes a stencil past its timer, say so and propose the timer, do not change it.
- [ ] The fast bounding-box sweep on the circle stays under 85 percent of the swept area under Flowy (speed still matters).
- [ ] Holding still for 1 second at a point lays a disc no larger than `needleR * wideScale` (no runaway pooling).

## D. Decision rule

The designer picks a preset on the phone; its values become the v0.3 defaults and the presets and sliders are removed in v0.4. If Crisp wins, inertia is dropped and the code path is removed.

## E. Tuning additions

| Name | Default (Flowy) | Meaning |
| --- | --- | --- |
| growRate | 14 | Radius units per second the needle widens toward its target |
| shrinkRate | 30 | Radius units per second it narrows |
| floorScale | 0.8 | Minimum radius as a multiple of needleR |
