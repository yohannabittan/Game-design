# Gravity Golf roadmap: zones (draft, 2026-10-07)

Source: the designer.
- "Every X many levels there's a cutscene and you go to the next zone, maybe every 20 levels or so."
- "One of the zones could be: as we're flying through space we reach a massive planet, and it becomes real golf for a zone."
- "It would add some narrative to the probe moving around and give us some artistic and mechanics inspiration."

The other ideas from the same day are in `docs/game-ideas.md`: Grand Tour, VS, Architect, antigravity structures and Burst Run.

## The shape

A **zone** is about 20 holes: four sectors of five. Each zone has its own look, its own new bodies and a chapter of the story. It ends on an animated cutscene that carries Lumen to the next zone. The select screen groups holes by zone.

| Zone | Holes | Story | What is new | Status |
| --- | --- | --- | --- | --- |
| 1. The Galaxy | 1 to 30 | Sam and Lumen look for life; at the core, another probe ("we're not alone") | planets, moons, suns, comets, black holes | built (v0.1 to v0.12); its ending is the v0.11 cutscene |
| 2. The Signal | 31 to 50 | Lumen follows the other probe outward. They pass strange structures someone built. | burst stars (Sector 7, v0.13), antigravity structures that push instead of pull, and a moving cup to dock with | Sector 7 being built |
| 3. The Giant | 51 to 70 | The other probe leads Lumen down to a world so big it bends the light. Lumen lands, and it becomes real golf. | a surface (see below) | idea |
| 4. First Contact | 71 to 90 | Who sent the probe | alien mode's ideas: saucers, a tractor beam, a drifting cup | idea (the backlog's alien mode) |

Each zone's closing cutscene is a Launch-style animated scene of about 15 s, skippable. It is the one place a zone spends art: a portrait or two plus a backdrop pack.

## Zone 3, The Giant: real golf, but it is still Gravity Golf

The idea: Lumen lands on a giant planet and plays on its surface, side-on, with the horizon curving away.
- **The ground pulls down,** as uniform gravity, so it feels like golf: rolls, bounces, slopes, bunkers and a flag.
- **The giant's moons hang huge in the sky and still pull the ball upward.** That keeps the game's soul: a lob that passes under a moon floats and curves.
- **Inspiration for mechanics:**
  - low-gravity bounces;
  - thick-air drag, so a high shot slows;
  - methane lakes, which slow the ball or make it skip;
  - bouncy fungus pads;
  - geysers, as in Launch;
  - wind bands;
  - a moon eclipse that switches a moon's pull on and off.
- **Inspiration for art:** a dusk-coloured alien links course, crystal flora, rings across the sky, and the other probe watching from a ridge.
- **Cost:** this is the biggest build on the list. It needs a new physics layer: terrain contact and rolling under uniform gravity, plus the point-mass pull Gravity Golf already has. Launch's terrain code is a reference, not a copy (ADR-0006: engines are not shared). The hole harness needs it too. Holes then follow the lean authoring method.

## Modes alongside the zones (from the backlog)

Grand Tour first, then VS, then Architect, with Burst Run after. Modes reuse the holes of every zone, so each new zone also feeds them.

## Open questions for the designer

- **Zone length:** 20 holes (4 sectors), or 15 (3 sectors) so that zone 2 reaches the giant sooner?
- **Ranks:** keep one ladder across all zones, or give each zone its own ladder (for example, the Giant's ranks as golf titles)?
