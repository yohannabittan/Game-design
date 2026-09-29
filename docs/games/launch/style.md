# Launch style anchor

Prepend verbatim to every image prompt for this game (ADR-0015):

"Flat round shapes, warm sky, soft shadows, one orange hero: a cheerful flat vector illustration with rounded silhouettes, a soft plum ink outline on every object, a warm sky that runs from cream and rose by day through violet dusk to an indigo night with small warm stars, a sage-green ground band, gentle drop shadows, no orange anywhere except the round orange critter, no text, no gradients on objects, no photorealism, calm and toy-like."

## Palette (TUNING.palette in games/launch/src/game.js)

| Role | Colour | Notes |
| --- | --- | --- |
| Hero (the only orange) | `#ff8a1a`, cheek `#ffb366` | ink outline and a light halo so it reads on every sky band |
| Good: springs, birds | teal `#1ea896`, light `#7fe0d2` | ink outline; a used spring goes grey-teal `#8fb3ad` |
| Danger: mud | body `#3d2414`, glossy rim `#f0d2ae` | the body carries it on light skies, the rim on the night sky: at least 3.2 to 1 on every band, 5.6 to 1 on the grass |
| Neutral: ramps, the fork | lilac `#b3a7c9`, wood `#b98b5e`, rubber `#6b3a6e` (taut `#d6336c`) | |
| Sky by altitude | day `#fff1dc` to `#f5c1c6`, dusk `#f3a9b8` to `#8f6fb0`, night `#4a3a78` to `#1d1a3a` | dusk at 120 m, night and stars at 300 m at the top of the view |
| Ground | grass `#7fae6a`, soil `#5f8a58`, hills `#ecc0c4` and `#dca5b3` | hills thin out as the sky pans up and are gone by night |
| Ink and text | ink `#2d2238`, text `#fff6ec` on ink panels | |
| Accents | coin yellow `#ffd84d` (coins, stars, beaks), button violet `#6b5aa6` | |

## Rules

- One outline weight (`TUNING.style.line`, 2 design px at zoom 1), one panel radius (14 px), round caps and joins.
- Every play object has an ink outline; the critter and birds add a light halo outside it.
- Type: three HUD sizes (14, 18, 28) plus 44 for titles; numbers and titles weight 800, words 600; nothing under 14 px.
- The background is never busier than the play objects: hills are pale and low, stars are small and dim.
