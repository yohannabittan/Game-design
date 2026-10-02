# Launch style anchor

Prepend verbatim to every image prompt for this game (ADR-0015):

"Flat round shapes, warm sky, soft shadows, one orange hero: a cheerful flat vector illustration with rounded silhouettes, a soft plum ink outline on every object, a warm sky that runs from cream and rose by day through violet dusk to an indigo night with small warm stars, a sage-green ground band, gentle drop shadows, no orange anywhere except the round orange critter, no text, no gradients on objects, no photorealism, calm and toy-like."

## Places (PLACES in games/launch/src/game.js)

One sentence per place, each read after the anchor above; the sky by day, the two-sine rolling hills and the ground band change per place, while dusk and night by altitude are shared.

- **The Bakery (0 to 500 m):** a cream-and-rose morning over soft pink rolling hills, a little shopfront with a pink-and-white striped awning beside the Mochi Maker 3000, and a sage-green ground band.
- **The Mochi Maker 3000 (the launcher, from v0.3):** a squat brass steam machine on a plum-iron plinth with a cream pressure gauge banded slate, blue, rose and gold, a row of round bulbs that light green, amber or red, a small iron chimney puffing white steam, and a brass barrel on an iron yoke with the mochi sitting in its mouth, never orange except the mochi.
- **Candy Meadow (500 to 1000 m):** a pale mint-cream sky over bumpier pink and mint hills dotted with tiny pastel gumdrops, on a fresh green ground band.
- **Chocolate River (1000 to 2000 m):** a peach-cream sky over long low cocoa-milk hills with a pale milk-chocolate river flowing in front of them, on a milk-chocolate ground band.
- **Soda Springs (2000 to 3500 m):** an aqua-to-periwinkle sky over tall lilac-blue hills with small white soda bubbles drifting up behind them, on a cool blue ground band where soda geysers fizz.
- **Gingerbread Town (3500 to 5000 m):** a butter-cream sky over flat biscuit hills lined with small gingerbread houses with white icing eaves, on a gingerbread ground band under pink cotton-candy clouds.
- **Home (from 5000 m):** a strawberry-milk sky over pink and pale green hills dotted with tiny strawberries, a cottage with a strawberry-red roof, and the round white daifuku waiting by the road.

## Objects added in v0.4 (drawn in games/launch/src/game.js)

One sentence per object, each read after the anchor above.

- **Oven-vent thermal:** a low rose-brick grate with glowing sugar-yellow slots under a tall, translucent cream column of wavy rose heat lines rising, ink outline and a light halo on the grate.
- **Freezer vent:** a low icy pale-blue grate with slate slots under a tall, translucent pale-blue column where white snowflakes and slate chevrons drift down, ink outline and a light halo on the grate.
- **Candy-cane hill:** one smooth round bump striped berry-red and white on the diagonal with a plum ink outline and a light halo, its uphill (left) face in soft shade so the face that crashes reads darker than the face that launches.
- **Marshmallow pad:** a row of fat, soft white pillows with round ends, a lilac shade along their bottoms and a few sugar specks, ink outline and a light halo, never teal so it never reads as a jelly.
- **Dough glider (v0.4 A1):** the mochi himself stretched flat into a wide apricot wing with its tips drawn out and lifted, the same plum outline, light halo and powder, a few lighter ribs where the dough pulls, and his little face unchanged in the middle, springing back round on release; no separate sail.

## Palette (TUNING.palette in games/launch/src/game.js)

| Role | Colour | Notes |
| --- | --- | --- |
| Hero: the apricot mochi (the only orange) | `#ff8a1a`, blush `#ffb366`, powder `#fff6ec` | ink outline and a light halo so it reads on every sky band |
| Good: mint jellies, geyser vents | teal `#1ea896`, light `#7fe0d2` | ink outline and light halo; a used jelly or vent goes grey-teal `#8fb3ad` |
| Birds | sugared pastel `#5fcbb8`, wing `#a9eadf`, white rim | ink outline |
| Danger: caramel | body `#341b08`, deeper `#1f0f04`, sheen `#9a5c16`, gloss `#f6d7a4` | sunk into the ground band, no outline: at least 3.6 to 1 on every place's ground top and soil (`tools/sim-launch.mjs --contrast`) |
| Soda geyser | vent `#e6eef8`, column `#f2fbff`, mouth `#3b4a6b` | ink outline and light halo; the column stands only while it erupts |
| Cotton-candy cloud | pink `#f8bfdc`, blush `#cfe2fb` | ink outline and light halo; a used cloud is a pale wisp |
| Neutral: wafers, chopsticks | wafer `#efdcb4` with `#c9a774` crosshatch; chopsticks plain `#e6d2ae`, lacquer `#9b2747`, gold `#f2c94c`; licorice `#d23a6e` to `#231a24` by Band level | |
| Gear | bottle glass `#cfeaf8`, soda `#6aa8e0`, cap `#e8476a`; nozzle `#9aa0b8`, cola `#6e3626` | drawn on the mochi at every level |
| The daifuku | dough `#fff0f4`, strawberry `#e8476a`, blush `#f7a8bf`, hearts `#ef5b8a` | |
| Sky by altitude | day per place (PLACES), dusk `#f3a9b8` to `#8f6fb0`, night `#4a3a78` to `#1d1a3a` | dusk at 120 m, night and stars at 300 m at the top of the view |
| Ground and hills | per place (PLACES): a top strip and soil, two hill colours | hills thin out as the sky pans up and are gone by night |
| Ink and text | ink `#2d2238`, text `#fff6ec` on ink panels | |
| Accents | sugar yellow `#ffd84d` (sugar text, stars, beaks), sugar cubes `#fffaf0`, button violet `#6b5aa6` | |

## Rules

- One outline weight (`TUNING.style.line`, 2 design px at zoom 1), one panel radius (14 px), round caps and joins.
- Every play object has an ink outline; the critter and birds add a light halo outside it.
- Type: three HUD sizes (14, 18, 28) plus 44 for titles; numbers and titles weight 800, words 600; nothing under 14 px.
- The background is never busier than the play objects: hills are pale and low, stars are small and dim.
