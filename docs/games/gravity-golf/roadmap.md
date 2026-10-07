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

### Bigger rooms: the designer's meaning (2026-10-07)

"I meant bigger rooms, like bigger levels, but yeah maybe a combination: a huge level with a huge planet with its gravity and the cup near the end."

- **A big room** is a hole two to four screens long, with the camera following the ball.
- **The aim view zooms out** so the whole room fits before a shot, then the camera follows the flight and settles on the rest. A two-finger pinch, or a "Look" button of at least 48 px, pans freely between shots.
- **The Giant hole:** the tee is at one end and the cup near the far end. A huge planet in the middle dominates the room, and its pull shapes every shot. Several shots across its gravity well, and its landings, make the route.
- **The physics and the harness don't change.** `sim-golf` already works in world coordinates, so room size is only data (a field size per hole), plus walls at its bounds.
- **What's new:** the camera, the zoom-out aim view, the Look pan, and very large bodies drawn with the limb shading and atmosphere glow above.
- **One foundation for three things.** The same big-room camera is what Grand Tour (long slingshot chains) and Burst Run (a long one-way course) need, so building it once serves all three.

### The Giant: four sectors, one giant planet each (designer, 2026-10-07: "a sector per type of planet and the zone has 4 different types of giant planets")

Every sector is a set of big rooms around one giant world. Each world's twist reuses an existing system or adds a single data field, with no new physics engine:

| Sector | Giant | The twist | Reuses |
| --- | --- | --- | --- |
| 1 | **The Gas Giant** (banded, with a great storm) | you cannot land on it, because it is gas; its upper atmosphere is a drag band that slows any ball skimming through; a family of moons orbits it | moons and orbits (existing); a drag band (one new zone type: a ring where speed decays) |
| 2 | **The Ringed Giant** | its rings are arcs of small rocks with gaps, so you thread a ring gap to reach the far side | small low-mass planets laid along an arc (existing bodies, many of them) |
| 3 | **The Ice Giant** | it is slippery: a landing skids along the curve before it stops, so you land early and slide to the cup | landing (existing), with per-body surface friction (one field) |
| 4 | **The Lava World** (a hot super-Earth) | glowing vents on its surface are hazards with the sun touch penalty, and quiet crust lies between them | landing and crater cups (bigger rooms), and the sun penalty as surface spots |

- **Each sector's arrival log and Probe Log fact is real and checked.** Candidates:
  - Jupiter's Great Red Spot is a storm wider than Earth.
  - Saturn's rings are mostly ice and in places only tens of metres thick.
  - Neptune has the fastest winds measured in the Solar System.
  - Planets larger than Earth but smaller than Neptune, called super-Earths, are common around other stars.
- **The zone's cutscenes:**
  - at the start, the other probe leads Lumen to a world that fills the sky;
  - at the end, past the four giants, the probes find the first structure (the antigravity sector), which leads on to First Contact.
- **Art:** one big-planet render per sector, drawn by the game (bands, rings, ice sheen, lava glow), and optionally a generated backdrop per sector. That is about 4 images, around $1.
- **Order of builds:**
  1. the big-room camera, built once and shared with Grand Tour and Burst Run;
  2. the Giant's small additions: the drag band, per-body friction and crater cups;
  3. four lean content passes of 5 holes each.

## Modes alongside the zones (from the backlog)

Grand Tour first, then VS, then Architect, with Burst Run after. Modes reuse the holes of every zone, so each new zone also feeds them.

## Open questions for the designer

- **Zone length:** 20 holes (4 sectors), or 15 (3 sectors) so that zone 2 reaches the giant sooner?
- **Ranks:** keep one ladder across all zones, or give each zone its own ladder (for example, the Giant's ranks as golf titles)?
