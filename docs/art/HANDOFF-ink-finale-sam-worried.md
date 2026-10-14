# Handoff: Packs 14 and 16, Sam worried and Ink's finale cast, with alt art kept (2026-10-14)

For the orchestrator session. From the art session.

## Status

Final and pushed: `docs/art/final/gravity-golf/mission-control-worried.png` (Pack 14) and eleven Ink files in `docs/art/final/ink/` (Pack 16). The designer said to check the brief and go ahead, so the art session picked. Nothing is wired. Ledger $35.03; with the palace mock-ups that the designer also asked for in this session ($4.82, not in the game ledger) the OpenAI account has used about **$39.85 of the $40 budget**, so there is room for one small job and no more without a raise.

## Alt art: both options kept (designer's idea, 2026-10-14)

The designer wants to switch between two pictures in game. From now on, where a pack has two options, the art session writes the pick as `<name>.png` and the other option beside it as `<name>-alt.png`, so a game can offer both. Files kept as alt art in this pack:

| Default | Alt | Notes |
| --- | --- | --- |
| `client-ines-happy.png` | `client-ines-happy-alt.png` | a second take of the same pose and clothes |
| `client-arlo-happy.png` | `client-arlo-happy-alt.png` | the alt has Arlo's other hand resting over part of the forearm, so its patch is partly covered |
| `rita-proud.png` | `rita-proud-alt.png` | a slightly wry smile, glasses lower on the nose |

**Limits you must design around:** an alt exists only for the images that had two options. The alts here are happy or proud portraits only; their neutral and sad pictures were made from the default, so an alt happy has no matching neutral or sad. Sam worried has no alt. Earlier packs deleted their unpicked options, so they have none, and will not unless the art session regenerates them. Switching is a game decision and a PRD item for you (where the choice lives, what it is called, whether it is per character or global); the art session only keeps the files.

## The files

| File | Size | Background |
| --- | --- | --- |
| `gravity-golf/mission-control-worried.png` | 512 x 512 | rounded video-call window, transparent outside it |
| `ink/client-ines-{happy,neutral,sad}.png`, `ink/client-arlo-{happy,neutral,sad}.png` | 768 x 1024 | opaque warm lamp-lit |
| `ink/rita-proud.png`, `ink/rita-kind.png` | 768 x 1024 | opaque warm lamp-lit |

Ink files are PNG like the six earlier clients (about 1.5 MB each); convert to WebP at wiring.

## Sam worried

Same Sam, same window, same headset and jacket. The room is dim and both screens behind glow red with charts, bars and warning triangles and no readable text; Sam's brow is pinched and the mouth is a small frown, still kind. **The mug is missing** (the brief asks for both hands round it): the first round's two takes had the mug but Sam was still smiling under blue screens, and the one take that changed the mood has no mug; the budget did not allow another try. If the PRD C2 needs the mug, say so and the art session will retry when the budget allows. A first round with the mug kept Sam smiling with the blue screens and was discarded.

## Ink: the skin patch rectangles

`x, y, w, h` in final-image pixels (768 x 1024), by eye on the happy or proud image and moved by the shift measured for each derived image. Starting points; the builder measures again.

| File | Patch rectangle |
| --- | --- |
| client-ines-happy | 142, 416, 352, 510 |
| client-ines-neutral | 140, 467, 352, 510 |
| client-ines-sad | 142, 431, 352, 510 |
| client-arlo-happy | 255, 649, 375, 210 |
| client-arlo-neutral | 258, 679, 375, 210 |
| client-arlo-sad | 252, 667, 375, 210 |
| rita-proud | 8, 818, 341, 206 |
| rita-kind | 8, 836, 341, 206 |

- **Ines** (shoulder and upper arm, three-quarter view from behind): a large bare area, about 60 percent of the width. She wears a sleeveless navy top with a small plain flame emblem on the back and no letters; the brief's "fire-service T-shirt with one sleeve rolled" became sleeveless so the shoulder is clear.
- **Arlo** (inner forearm, seated): the forearm is held out across the lower third with the palm up; the gold wedding ring is on the hand, well clear of the patch. The rectangle includes a little wrist.
- **Rita** (inner forearm, in the client's chair): the bare forearm is her left arm, coming toward the viewer at the lower left; the **hand is cropped at the bottom edge** and her right arm carries the faded flash. The rectangle is the forearm only.
- The derived images (neutral, sad, kind) sit between 20 and 70 px lower than their reference in raw pixels, so measure each one. Ines neutral moves most, 68 px in the 1024 x 1536 original.

## Notes

- The brief asked for Pack 11 final `client-june-happy.png` as a style reference. I generated Ines and Arlo from the same anchor and prompt scaffold as Pack 11 without it, which in Pack 11 matched across the six; they sit in the same painted style.
- Prompts and costs: `docs/assets-ledger.md`. Retry: Sam's first round. About $1.09 for these two packs.

Line for the designer to paste into the orchestrator: "Packs 14 and 16 are final in docs/art/final (Sam worried in gravity-golf; Ines, Arlo and Rita's finale in ink), with alt art kept as -alt files; read docs/art/HANDOFF-ink-finale-sam-worried.md and decide where the alt switch lives."
