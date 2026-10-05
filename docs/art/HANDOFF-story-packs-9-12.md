# Handoff: Packs 9 to 12, candidates ready for the designer's picks (2026-10-05)

For the orchestrator session. From the art session.

## Status

All four packs are generated and pushed as candidates with one contact sheet each. **Nothing is final yet**: the designer picks A or B per image from the sheets, then the art session writes the finals to `docs/art/final/<slug>/` under the brief's file names, deletes the rest and updates this note. Wiring can be written now against the final names; a pick changes which picture it is, not its name, size or framing. Ledger: $33.46 of the $40 budget, of which $3.83 went on tests and discarded retries.

Sheets (GitHub Pages lags a minute after the push):

- Pack 9, Recoil: `https://yohannabittan.github.io/Game-design/docs/art/candidates/recoil/sheet-pack9.png`
- Pack 10, Checkpoint: `https://yohannabittan.github.io/Game-design/docs/art/candidates/checkpoint/sheet-pack10.png`
- Pack 11, Ink: `https://yohannabittan.github.io/Game-design/docs/art/candidates/ink/sheet-pack11.jpg`
- Pack 12, Gravity Golf: `https://yohannabittan.github.io/Game-design/docs/art/candidates/gravity-golf/sheet-pack12.png`

## Final files (names and sizes the wiring can rely on)

| Slug | Files | Size | Background |
| --- | --- | --- | --- |
| recoil | `director.png`, `director-approve.png` | 512 x 768 | transparent |
| recoil | `poster-accuracy.png`, `poster-speed.png`, `poster-skeet.png`, `poster-boss.png`, `poster-zombies.png`, `poster-endless.png` | 512 x 768 | opaque, no text at all |
| checkpoint | `supervisor.png`, `supervisor-proud.png` | 512 x 768 | transparent |
| checkpoint | `plane.png` | 1024 x 384 | transparent |
| ink | `client-<bram,theo,june,ola,mina,kai>-<happy,neutral,sad>.png` (18) | 768 x 1024 | opaque warm lamp-lit, no tattoo anywhere |
| ink | `rita.png` | 512 x 768 | transparent |
| gravity-golf | `mission-control.png`, `mission-control-wow.png` | 512 x 512 | rounded video-call window, transparent outside it |

The Ink clients are one set per client: the designer picks A or B for a client and all three expressions come from that option. Opaque PNG at 768 x 1024 is about 1.5 MB each, so the 18 Ink finals are about 27 MB in the repo; the game wants WebP (PRD F), which is about 0.3 MB each. If you would rather have WebP finals in `docs/art/final/ink/`, say so and I will write them that way.

## Ink: the skin patch rectangles (the reveal depends on these)

The brief asked for the patch rectangle per client. **Measure it per image, not per client**: the neutral and sad portraits were redrawn from the happy one, and the body sits up to about 50 px lower (in the 768 x 1024 final) in some of them (Bram, June B, Ola A and Kai A most; Mina not at all). The rectangles below are `x, y, w, h` in final-image pixels. Happy is read by eye from an overlay on the happy portrait; neutral and sad are the happy rectangle moved by the shift I measured between the two images. Treat all of them as starting points; the builder measures again.

| Client, option | happy | neutral | sad |
| --- | --- | --- | --- |
| bram A | 308, 581, 345, 218 | 310, 632, 345, 218 | 310, 629, 345, 218 |
| bram B | 308, 596, 345, 210 | 310, 644, 345, 210 | 310, 623, 345, 210 |
| theo A | 525, 371, 150, 420 | 528, 389, 150, 420 | 528, 380, 150, 420 |
| theo B | 525, 386, 142, 405 | 528, 413, 142, 405 | 528, 398, 142, 405 |
| june A | 135, 401, 465, 330 | 138, 428, 465, 330 | 138, 431, 465, 330 |
| june B | 142, 424, 465, 322 | 146, 475, 465, 322 | 142, 454, 465, 322 |
| ola A | 165, 446, 480, 255 | 162, 494, 480, 255 | 165, 467, 480, 255 |
| ola B | 225, 424, 420, 285 | 225, 454, 420, 285 | 231, 436, 420, 285 |
| mina A | 345, 514, 240, 172 | 345, 511, 240, 172 | 345, 514, 240, 172 |
| mina B | 398, 529, 225, 142 | 398, 535, 225, 142 | 398, 529, 225, 142 |
| kai A | 180, 416, 405, 315 | 183, 452, 405, 315 | 186, 422, 405, 315 |
| kai B | 172, 401, 390, 330 | 176, 422, 390, 330 | 172, 407, 390, 330 |

What the patch is on each client, and what to watch:

- **Bram** (forearm, seated): a diagonal forearm running from the elbow at the right to the wrist at the left; the rectangle includes some sweater at its corners. About 45 percent of the image wide.
- **Theo** (forearm, standing): a vertical forearm below the raised fist, **only about a fifth of the image wide**, narrower than the "third" asked for; the tattoo will sit narrow and tall.
- **June** (shoulder and upper back): a large bare area, about 60 percent wide. The cardigan is below it.
- **Ola** (shoulder and upper arm): large; a white cloth hangs behind the shoulder and reads like a veil, but it does not touch the patch. The off-shoulder top is a plain white blouse.
- **Mina** (calf): the bare shin is held straight out and slopes down to the right, so the rectangle is a bounding box of a diagonal limb, about 30 percent wide, and includes a little thigh and stool.
- **Kai** (upper back): large, between the shoulder blades, seen from behind.

No tattoo, jewellery, hair, watch or clothing is over any patch (checked by eye on all twelve happy portraits). Rita's forearms are covered in faded flash on purpose; she is the only person with tattoos.

## Things to know before wiring

- **Posters carry no text.** The game draws the titles. The brief asked for a calm darker bottom fifth for them; the bottom edge is dark on accuracy, speed and boss, but on skeet, zombies and endless the hero or foreground props reach it, so put the title on a scrim for all six.
- **Director:** the shouting and approving poses are the same man (cap, sunglasses on the forehead, red megaphone); the approving pose lowers the megaphone to his hip and gives a thumbs-up. In option A's approving pose the sunglasses are small on the cap.
- **Supervisor Pat:** briefing (clipboard and coffee) and proud (arms folded). Both have reading glasses on a cord on the chest in option A; in option B she wears them on her face.
- **Plane:** a generic twin-engine jet facing right. Option A has a green tail and orange engines, option B a peach tail and teal stripe; neither has any text. The brief asked for one soft colour stripe, so B is closer.
- **Mission Control:** Sam in a rounded video-call window. In option A's amazed pose the window interior is transparent (the blue star-chart screens were lost); option B keeps them. If A is picked I will regenerate it.
- Mission Control's amazed pose and every second and third pose were made from the first as a reference. Where the brief says "same man", the same man appears.
- The procedural fallbacks the PRDs describe stay in place until the files land.

## Prompts and cost

Prompts are in `docs/assets-ledger.md`: the style anchor verbatim, plus the Recoil showpiece sentence for the director and posters; Checkpoint's portraits use a flat cast sentence because its anchor describes a transparent X-ray of an object and makes a photographic portrait when used for a person (tested; see `LEARNINGS.md`). Generation took retries on Mina, Kai and Ola (the first round showed a small or marked skin patch), the director's approving pose and Sam's amazed pose.

Line for the designer to paste into the art chat once he has picked: "Finalise Packs 9 to 12: director A, posters accuracy B, speed A, ..., clients bram A, theo B, ..., rita A, supervisor B, plane B, mission control B."
