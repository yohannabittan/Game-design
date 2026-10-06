# Handoff: Packs 9 to 12 are final (2026-10-06)

For the orchestrator session. From the art session.

## Status

All 32 images are final in `docs/art/final/<slug>/`, written from the full-size generations, and the candidates are deleted. **The designer said "you pick", so the art session chose** (reasons below); if he wants to swap any, say which and it can be rebuilt while this session lasts, otherwise it needs a regeneration. Nothing is wired. Ledger: $33.46 of the $40 budget, of which $3.83 went on tests and discarded retries; the prop master rows from the earlier handoff are now marked too.

## The files

| Slug | Files | Size | Background |
| --- | --- | --- | --- |
| recoil | `director.png`, `director-approve.png` | 512 x 768 | transparent |
| recoil | `poster-accuracy.png`, `poster-speed.png`, `poster-skeet.png`, `poster-boss.png`, `poster-zombies.png`, `poster-endless.png` | 512 x 768 | opaque, no text at all |
| checkpoint | `supervisor.png`, `supervisor-proud.png` | 512 x 768 | transparent |
| checkpoint | `plane.png` | 1024 x 384 | transparent |
| ink | `client-<bram,theo,june,ola,mina,kai>-<happy,neutral,sad>.png` (18) | 768 x 1024 | opaque warm lamp-lit, no tattoo anywhere |
| ink | `rita.png` | 512 x 768 | transparent |
| gravity-golf | `mission-control.png`, `mission-control-wow.png` | 512 x 512 | rounded video-call window, transparent outside it |

**Size:** the 18 Ink client PNGs are about 27 MB together (1.5 MB each); the whole set is 33 MB. PRD F wants WebP in the game, about 0.3 MB each, so convert at wiring; if you would rather have WebP in `docs/art/final/ink/`, say so and the art session will write it.

## What was picked, and why

- **Director B:** the sunglasses stay visible on the cap in both poses, and the pair is the cleaner match.
- **Posters, all A:** accuracy (a spotlit silhouette in front of the targets), speed (the clock tower with a blank face), skeet (visible wires, the saucers clearly clay pigeons), boss (a visible zipper down the monster's chest), zombies (wardrobe tags, a boom mic), endless (slumped hero, cups, a blank clapperboard, dawn). Option B of the endless poster showed a burning skyline that read as an explosion, not dawn.
- **Supervisor A:** reading glasses on a cord on her chest, as the brief says; B wears them on her face.
- **Plane B:** the closest to a white body with one soft stripe.
- **Clients:** Bram B, Theo A, June A, Ola B, Mina A, Kai B, chosen where the neutral and sad portraits stay closest to the happy one (the reveal is cleaner), then by the patch's clarity.
- **Rita A:** larger, cleaner, the flash sleeves more readable.
- **Mission Control B:** the blue star-chart screens are kept in both poses.

## Ink: the skin patch rectangles (the reveal depends on these)

Measure the rectangle **per image, not per client**: the neutral and sad portraits were redrawn from the happy one and the body sits lower in most of them (Bram by up to about 50 px in the 768 x 1024 final, June and Ola by about 30, Kai by about 20; Theo by under 20 and Mina not at all). Rectangles are `x, y, w, h` in final-image pixels. Happy is read by eye from an overlay; neutral and sad are the happy rectangle moved by the shift I measured. Starting points only, as the brief says the builder measures again.

| Client | happy | neutral | sad |
| --- | --- | --- | --- |
| bram | 308, 596, 345, 210 | 310, 644, 345, 210 | 310, 623, 345, 210 |
| theo | 525, 371, 150, 420 | 528, 389, 150, 420 | 528, 380, 150, 420 |
| june | 135, 401, 465, 330 | 138, 428, 465, 330 | 138, 431, 465, 330 |
| ola | 225, 424, 420, 285 | 225, 454, 420, 285 | 231, 436, 420, 285 |
| mina | 345, 514, 240, 172 | 345, 511, 240, 172 | 345, 514, 240, 172 |
| kai | 172, 401, 390, 330 | 176, 422, 390, 330 | 172, 407, 390, 330 |

- **Bram** (forearm, seated): a diagonal forearm from the elbow at the right to the wrist at the left; the rectangle includes some sweater at its corners. About 45 percent of the image wide.
- **Theo** (forearm, standing): a vertical forearm below the raised fist, **only about a fifth of the image wide**, narrower than the third asked for; the tattoo will sit narrow and tall.
- **June** (shoulder and upper back): a large bare area, about 60 percent wide; the cardigan is below it.
- **Ola** (shoulder and upper arm): large; a white cloth hangs behind the shoulder and reads like a veil, but does not touch the patch. The top is a plain white off-the-shoulder blouse.
- **Mina** (calf): the bare shin is held straight out and slopes down to the right, so the rectangle is a bounding box of a diagonal limb, about 30 percent wide, with a little thigh and stool in it.
- **Kai** (upper back): large, between the shoulder blades, seen from behind.

No tattoo, jewellery, hair, watch or clothing is over any patch (checked by eye on every happy portrait). Rita's forearms carry faded flash on purpose; she is the only person with tattoos.

## Things to know before wiring

- **Posters carry no text.** The game draws the titles. The brief asked for a calm darker bottom fifth; the bottom is dark on accuracy, speed and boss, but on skeet, zombies and endless the hero or foreground props reach it, so put the title on a scrim for all six.
- **Director:** the shouting and approving poses are the same man; the approving pose lowers the megaphone to his hip and gives a thumbs-up.
- **Supervisor Pat:** briefing (clipboard and coffee) and proud (arms folded, clipboard under one arm).
- **Plane:** a generic twin-engine jet facing right with a peach tail and a teal stripe; no text or logo.
- **Sam:** in a rounded video-call window with a thin violet border; the area outside the window is transparent.
- Every second and third pose was made from the first as a reference, so each pair or trio is one person.
- The procedural fallbacks the PRDs describe stay until the files are wired.

## Prompts and cost

Prompts are in `docs/assets-ledger.md`: the style anchor verbatim, plus the Recoil showpiece sentence for the director and posters. Checkpoint's portraits use a flat cast sentence, because its anchor describes a transparent X-ray of an object and gives a photograph when used for a person (tested; see `LEARNINGS.md`). Retries: Mina, Kai and Ola (the first round had a small or marked skin patch), the director's approving pose and Sam's amazed pose.

Line for the designer to paste into the orchestrator: "Packs 9 to 12 are final in docs/art/final (director and posters in recoil, supervisor and plane in checkpoint, clients and Rita in ink, Sam in gravity-golf); read docs/art/HANDOFF-story-packs-9-12.md and wire them."
