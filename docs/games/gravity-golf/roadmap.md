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
| 3. The Giant | 51 to 70 | The other probe leads Lumen to a world so big it fills the sky; Lumen plays across its surface | giant planets bigger than the screen, crater cups on the surface, rocks as mounds, moons overhead (see below) | idea, rescoped to reuse |
| 4. First Contact | 71 to 90 | Who sent the probe | alien mode's ideas: saucers, a tractor beam, a drifting cup | idea (the backlog's alien mode) |

Each zone's closing cutscene is a Launch-style animated scene of about 15 s, skippable. It is the one place a zone spends art: a portrait or two plus a backdrop pack.

## Zone 3, The Giant: bigger rocks, not a new game (revised 2026-10-07)

The designer: "maybe the Giant as it currently stands is too big a build that doesn't reuse enough. I think we could definitely do bigger rocks though."

So the Giant stays in space and keeps the point-mass physics. It reuses what exists:
- **Giant planets** larger than the screen: only a curved limb shows, at the bottom or side of the field. A planet is still a circle, just a huge one.
- **Landing,** which already exists (`landSpeed`): you come to rest on the surface.
- **Cups on the surface.** A crater cup sits on the curve, so a shot lands, rests, then hops along the limb to the cup. That is the "real golf" feel: short hops over a curved ground.
- **Small rocks** sitting on or above the limb (low-mass planets) act as mounds and ridges.
- **The giant's moons** overhead pull the ball up and away.

What's new, and small:
- a crater cup (a cup whose mouth faces out from a planet's surface);
- drawing for very large bodies: limb shading, surface texture and an atmosphere glow;
- if wanted after a playtest, a little roll along the surface after landing.

All of this fits the lean authoring method: holes start from the existing landing holes (2, 6 and 13).

## Modes alongside the zones (from the backlog)

Grand Tour first, then VS, then Architect, with Burst Run after. Modes reuse the holes of every zone, so each new zone also feeds them.

## Open questions for the designer

- **Zone length:** 20 holes (4 sectors), or 15 (3 sectors) so that zone 2 reaches the giant sooner?
- **Ranks:** keep one ladder across all zones, or give each zone its own ladder (for example, the Giant's ranks as golf titles)?
