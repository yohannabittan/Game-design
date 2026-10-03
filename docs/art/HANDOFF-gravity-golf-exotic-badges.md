# Handoff: Gravity Golf exotic and secret badges, a Black Hole tier, a burst hazard, and an alien mode (designer decisions, 2026-10-03)

For the orchestrator session. From the art session. The designer talked these through with the art session; this note separates what is decided from what is proposed.

## Decided

- Gravity Golf gets **exotic rare badges** on top of the eleven it has. Some are **secret**: shown as a blank slot until earned, name and condition hidden, so finding one is the reward.
- A **fifth badge tier, Black Hole**, above star gold, for the rarest. Medal rim: near-black with a thin glowing orange accretion ring, matching the top of the rank ladder.
- **Names stay on the parody side.** A wink is fine; a quoted phrase, a character name or a title from someone else's work is not, because the repo is a public website. Same rule as the Recoil guns.
- Medal art comes from the art session in the rich showpiece style (`HANDOFF-showpiece-art.md`) once the list is locked in a PRD. Art does not run ahead of the PRD.

## The badges (names chosen by the designer; conditions proposed, drop any the game cannot detect cleanly)

| Name | Condition (proposed) | Tier | Secret | Symbol (for the medal) |
| --- | --- | --- | --- | --- |
| Improbability Drive | Take exactly 42 shots on one hole and still hole out | Black Hole | yes | a folded towel on a tee, a few question-mark sparkles |
| Wormhole | Hole in one from the farthest tee of a hole | Black Hole | no | a glowing tunnel with the cup at the far end |
| Dark Matter | Hole out on a shot whose path never came within a wide margin of any body: pure gravity, no visible cause | Black Hole | yes | an empty dark disc with a faint violet ring |
| Heat Death | Hole out with the slowest possible roll-in, the ball just reaching the lip | Black Hole | yes | a dim grey ball at a cold blue cup |
| Great Attractor | Every hole of a sector under par | Star | no | a cluster of small galaxies pulled toward one bright point |
| Kessler Cascade | Hit every wall on a hole at least once and still make par (the orbital-debris chain reaction) | Planet | no | a cloud of tumbling fragments round a cup |
| Lagrange Point | Bring the ball to a near standstill between two bodies, then hole out on the same shot | Star | no | a ball balanced on the line between two planets |
| Relativistic | Reach a very high speed on any shot (threshold set by the harness, reachable by a good player) | Planet | no | a ball stretched into a streak |
| FTL | Reach a far higher speed (threshold set by the harness, reachable only with a slingshot chain) | Black Hole | no | a ball ahead of its own light cone |

Notes for the PRD:

- **Improbability Drive needs a hole that can run to 42 shots.** If there is a shot cap or a give-up prompt before 42, the badge is unreachable; the cap must sit above it or the badge must trigger at the cap.
- The name is the designer's pick. If it reads as too close to its source, "Improbability" alone keeps the wink.
- Relativistic and FTL are a pair: one threshold a good player reaches, one that needs a slingshot chain. The harness sets both numbers.
- Secret badges still count toward the rank ladder once earned; whether the slot shows a hint ("???") or nothing is an open question for the PRD.

## Mechanic proposal: the burst (not decided, for a later PRD)

A **gamma-ray burst** or supernova as a hazard: somewhere on screen a star goes off, a shock front spreads outward over a few seconds, and the ball must be out of the zone before the front reaches it, or the shot is lost. Readable from the start (the star flares before it blows), fair (the front's speed is fixed and shown), and it rewards planning a route rather than reacting. It could live in one sector, or in a new sector of its own, and a badge ("Burst Survivor") could go with it.

## Backlog entry: an alien mode (for `docs/game-ideas.md`, not scheduled)

Gravity Golf, alien mode: a separate mode with its own tone, kept apart from the celestial ladder and badges. Kernel: the same gravity shots, with saucers as moving bodies or hazards, a tractor beam that bends the ball's path while it is inside the beam, and an abduction hole where the cup itself drifts. Its own small badge set (First Contact, Probe, Mothership). Pattern: the existing gravity-golf kernel plus moving targets; status: idea.

## What you do

1. Add the alien mode to `docs/game-ideas.md` and the burst to the Gravity Golf open ideas.
2. Write the badge PRD change: the nine badges above with final conditions, the Black Hole tier, the secret-slot rule, and the 42-shot cap check. Lock it with the designer.
3. The medals are already final (designer's choice to go ahead of the PRD, 2026-10-03): `docs/art/final/gravity-golf/medal-<id>.png` for the nine ids above, 256 px, rich style, Black Hole rim on the five rarest. If the PRD renames or drops a badge, tell the art session.

## Orchestrator reply (2026-10-03): locked in `docs/games/gravity-golf/prd-v0.7.md`

Go ahead with the nine medals: showpiece style, two options each, 256 x 256, transparent, Black Hole tier rim near-black #17151c with a thin glowing orange accretion ring #fb923c, the Star, Planet tiers as the existing medals. Files, ids and tiers:

| File | Name | Tier | Symbol |
| --- | --- | --- | --- |
| `medal-improbability.png` | Improbability Drive (the designer kept the full name) | Black Hole | a folded towel on a tee, question-mark sparkles |
| `medal-wormhole.png` | Wormhole | Black Hole | a glowing tunnel with the cup at the far end |
| `medal-dark-matter.png` | Dark Matter | Planet (purple #a855f7) | an empty dark disc with a faint violet ring |
| `medal-heat-death.png` | Heat Death | Black Hole | a dim grey ball at a cold blue cup |
| `medal-ftl.png` | FTL | Black Hole | a ball ahead of its own light cone |
| `medal-great-attractor.png` | Great Attractor | Star (gold #fde047) | small galaxies pulled toward one bright point |
| `medal-lagrange-point.png` | Lagrange Point | Star (gold #fde047) | a ball balanced on the line between two planets |
| `medal-kessler-cascade.png` | Kessler Cascade | Planet (purple #a855f7) | tumbling fragments round a cup |
| `medal-relativistic.png` | Relativistic | Planet (purple #a855f7) | a ball stretched into a streak |

The secret "?" slot is drawn by the game, no image needed. Note for the PRD record: badges do not move the rank (v0.6 is stars only).
