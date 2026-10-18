# Art pass brief (for the session that holds the image key)

You are a Claude Code session with `OPENAI_API_KEY` in your environment, opened on this repository to generate image assets for the game library. A separate orchestrator session runs the game builds; this file is your whole handoff. Read it, then `CLAUDE.md`, then `docs/adr/0015-generated-assets.md` (the rules you work under).

## The designer

Yohann, a CPO who does not code. He plays the games on his iPhone from a home-screen icon, offline. He picks; you propose. Show him options before anything is wired in.

## First checks (do these before anything else)

1. Confirm the key without revealing it: `[ -n "$OPENAI_API_KEY" ] && echo present || echo missing`. Never print, log, echo, commit or write the key to any file. If it is missing, say so and stop.
2. Confirm the image host is reachable through the proxy (a tiny, cheap request). If it is blocked, say so and stop; the designer fixes network access in the environment settings.
3. The designer's Claude plan was near its weekly limit on 2026-10-02 (resets Monday evening). Keep your own work lean: write small scripts, no long loops.

## Rules (from ADR-0015, summarised)

- **One style anchor per game:** `docs/games/<slug>/style.md`. Every prompt is the anchor verbatim, then the subject, then the technical spec. Nothing else.
- **Ledger:** append every generation to `docs/assets-ledger.md` (date, game, subject, size, quality, cost estimate, kept or discarded, path, the full prompt). Stop when the ledger reaches the budget below.
- **Budget: US$80 total** on the OpenAI account (first pass $15, raised to $25, then to $40 on 2026-10-03, and doubled to $80 by the designer on 2026-10-14), unless the designer raises it again. The provider cap was $50 at the last note: past $50 a generation fails until the designer raises the cap in the OpenAI billing settings, so check before a pack that would cross it.
- **Images are for things you look at, never for things you play with.** Titles, portraits, backdrops, icons, medals, menu art: yes. Anything moving, hit-tested or physics-driven (the mochi in flight, targets, planets, jellies, items on the X-ray belt): no, those stay procedural canvas (their drawn shape is their hitbox, design principle 14).
- **Technical:** sprites are transparent PNG (or WebP), backgrounds opaque; size each to its on-screen use at 3x phone density, no larger; a game's `assets/` folder stays under 1.5 MB; nothing private or copyrighted in prompts (the repo is a public website). Recoil uses parody names only, no real film titles, actors or logos.
- **Do not edit any `games/<slug>/src/game.js`.** Wiring images into a game is a build layer the orchestrator dispatches (prompt `prompts/05-art.md`, which allows `games/<slug>/assets/` and the `sw.js` cache list). Your job ends at chosen files in the repo plus the ledger.

## What to make first (two packs)

### Pack 1: Recoil "Backlot 88" movie-prop guns

Anchor: `docs/games/recoil/style.md`. Context: `docs/games/recoil/prd-v0.6.md` (the guns and their parody names). One side-view gun per prop, transparent background, facing right, about 512 px wide, matching the procedural silhouettes' proportions:

| File | Gun | Look |
| --- | --- | --- |
| `gun-buddy-cop.png` | Buddy-Cop 9mm | a classic black service pistol |
| `gun-pulse-rifle.png` | Pulse Rifle | a chunky sci-fi rifle with a big ammo counter |
| `gun-spin-lever.png` | Spin-Lever Shotgun | a lever-action shotgun with a big loop lever |
| `gun-assassins-scope.png` | Assassin's Scope | a long marksman rifle with a scope |
| `gun-one-man-army.png` | One-Man Army SMG | a compact submachine gun |
| `gun-make-my-day.png` | Make-My-Day .44 | a long-barrelled revolver |

Plus `title-backlot88.png`: the studio-logo title card "RECOIL, a Backlot 88 production" (about 1024 x 384, transparent).

### Pack 2: Ink title

Anchor: `docs/games/ink/style.md`. Context: `docs/games/ink/prd-v0.6.md` line on the title. `title-ink.png`: the word INK as an ornate tattoo-script logo (blackletter meets calligraphy, flourishes, a banner or swallow or rose allowed), transparent, about 1024 x 512, plus a half-size copy.

### Pack 3: Checkpoint X-ray items (added 2026-10-03)

Anchor: `docs/games/checkpoint/style.md` (anchor v0.2, the material-coloured scanner look; the designer decided the belt items become images with generous rectangle hitboxes, because the skill is recognition, not precise tapping). These are an exception to "never for things you play with": the game hit-tests a rectangle around each image, and the wiring build handles fairness.

- One item per image, top-down, centred, filling about 80 percent of a square canvas, **transparent background**; 1024 x 1024 generation, saved down to **256 x 256** (the game draws them at about 40 to 90 px).
- Each must read as its object at a glance at 64 px in X-ray colours: test by shrinking it in the contact sheet. The silhouette tell matters most: a gun's grip, trigger guard and barrel; a blade's point; a lighter's hood and flint wheel; scissors' two finger rings.
- **Two options each** at medium quality (about 56 items, about US$7), on contact sheets of 14 to 16 items each, labelled by file name, each option also shown at 64 px.
- Files `item-<name>.png` with the names below (spaces become hyphens).

Belt contraband (15): knife, scissors, gun, lighter, large liquid, batteries, fireworks, taser, hammer, box cutter, explosives, brass knuckles, toy gun, snow globe, multi-tool.

Belt harmless (31): shirt, shoes, phone, laptop, headphones, book, toothbrush, charger, small liquid, sunglasses, hairdryer, pen, umbrella, camera, wallet, keys, toy, water bottle, belt, snacks, perfume, fork, knitting needles, power bank, tablet, banana, stapler, cable, usb stick, mug, tape measure.

Body scan only (10, drawn on the scanned silhouette, same look, 128 x 128 is enough): hair clip, glasses, earrings, wristwatch, ring, underwire, belt buckle, zipper, coins, knee brace. (Body contraband reuses the belt images: gun, knife, taser, brass knuckles, lighter; the blade in a boot reuses box cutter.)

Ledger and process as above; keep within the remaining budget. Final picks go to `docs/art/final/checkpoint/`.

### Pack 4: home-screen icons, all five games (added 2026-10-03)

One app icon per game, each from its own game's anchor: `icon-<slug>.png` for gravity-golf, ink, recoil, launch and checkpoint, into `docs/art/final/<slug>/`. **Opaque, square, 1024 x 1024**, no transparency (iOS fills transparency with black), no text, one bold central subject that reads at 60 px, nothing important within 10 percent of the edge (iOS rounds the corners). Subjects: Gravity Golf a glowing golf ball curving round a small planet; Ink a tattoo machine with a drop of ink; Recoil the Buddy-Cop pistol in its Backlot 88 neon (use the picked gun as reference); Launch the orange mochi mid-flight with a little fizz trail; Checkpoint a bag in X-ray colours with a red scan line. Two options each; show them on one sheet at 1024 and at 60 px.

### Pack 5: Launch characters and machine (added 2026-10-03)

Anchor: `docs/games/launch/style.md`. Context: `docs/games/launch/prd-v0.2.md` section E (the story) and `prd-v0.3.md` section A (the Mochi Maker 3000). Transparent backgrounds, into `docs/art/final/launch/`:

| File | Subject | Size |
| --- | --- | --- |
| `mochi-happy.png`, `mochi-determined.png`, `mochi-dizzy.png`, `mochi-love.png` | Mochi, the round apricot-orange mochi hero, small face, four expressions (cheerful; determined, ready to launch; dizzy after a crash, little stars; heart eyes) | 512 x 512 |
| `daifuku.png`, `daifuku-wave.png` | Daifuku, his love: a soft pink strawberry daifuku with a little strawberry peeking from the top, sweet face, waiting and waving | 512 x 512 |
| `mochi-maker.png` | The Mochi Maker 3000: a steampunk brass machine with pistons, a chimney, five bulbs, a pressure gauge and a barrel, cheerful, side view | 1024 x 768 |

Keep the same character across every Mochi image (shape, colour, face): generate one first, then use it as the reference image for the rest. Two options each.

### Pack 6: Gravity Golf title and badge medals (added 2026-10-03)

Anchor: `docs/games/gravity-golf/style.md`. Transparent backgrounds, into `docs/art/final/gravity-golf/`:

- `title-gravity-golf.png` (about 1024 x 400): the words GRAVITY GOLF as a space-themed logo (a golf ball as one O, an orbit ring through the letters). The anchor says no text: for this one asset, text is the subject; keep everything else per the anchor.
- 11 badge medals, `medal-<id>.png`, 256 x 256, round, a symbol for the badge in the middle and the rim coloured by tier (0 meteorite rock grey #a8a29e, 1 moon silver-blue #c9d6ea, 2 planet purple #a855f7, 3 star gold #fde047), no text:

| id | Name | Tier | Symbol idea |
| --- | --- | --- | --- |
| first-orbit | First Orbit | 0 | a ball tracing one orbit round a planet |
| banker | Banker | 0 | a ball banking off a wall |
| slingshot | Slingshot | 1 | a ball whipping round a planet |
| touchdown | Touchdown | 1 | a ball landing on a planet's top |
| untouched | Untouched | 1 | a sun with a ball passing clear |
| binary-star | Binary Star | 2 | two suns side by side |
| clockwork | Clockwork | 2 | a moon on its orbit like a clock hand |
| never-landed | Never Landed | 2 | a ball in flight above a row of planets |
| eclipse | Eclipse | 3 | a moon crossing a sun |
| perfect-run | Perfect Run | 3 | three stars over a cup flag |
| under-par | Under Par | 3 | a cup flag with a downward arrow |

Medals in one style and frame (generate one, use it as the reference for the rest). Two options each.

### Pack 7: Recoil gun skins (added 2026-10-03)

Anchor: `docs/games/recoil/style.md`, the play-object look (no showpiece sentence). The designer wants the gun in play, and every skin, to be the picture. So each skin is the **same gun as its picked standard picture, repainted**: same pose, outline, proportions and size, facing right, transparent background, about 512 px wide. Use the standard picture in `docs/art/final/recoil/gun-<gun>.png` as the reference image for every skin of that gun, so the silhouette matches exactly. The game recoils and rotates the picture, so nothing may stick out past the standard outline.

Files are `gun-<gun>-<skin>.png` into `docs/art/final/recoil/`. Two options each, on one contact sheet. The hex values are the game's own palette for that skin (steel / dark steel / accent):

| Gun file | Skin | Look | Colours |
| --- | --- | --- | --- |
| gun-buddy-cop | nickel | polished nickel with an engraved brass plate on the grip | #cfd4da / #8a929c / #d6a23a |
| gun-buddy-cop | blackout | matte black-grey, a black band across the slide | #7d828a / #5a5651 / #15120f |
| gun-buddy-cop | gold | gold-plated, two bright pale-gold stripes | #e3b53d / #a8781c / #fff1b8 |
| gun-pulse-rifle | desert | sand tan, tape wrapped round the forend | #c2a374 / #7d6641 / #ecdcae |
| gun-pulse-rifle | arctic | white-grey, one steel-blue stripe along the body | #e2e8f0 / #94a3b8 / #4a6fa5 |
| gun-spin-lever | walnut | walnut wood stock and forend, an engraved gold plate | wood #7a4a2a / accent #d6a23a |
| gun-spin-lever | tactical | olive drab, a dark stripe on the barrel and a dark pump band | #8c9668 / #59603f / #1f2416 |
| gun-assassins-scope | carbon | dark grey with carbon-fibre weave lines on the receiver | #858c93 / #565c63 / #1a1d22 |
| gun-assassins-scope | bronze | warm bronze, an engraved plate on the receiver | #b8834a / #7a542c / #e8c48a |
| gun-assassins-scope | ghost | pale ghost-white, a soft lavender engraved plate on the stock | #eceef2 / #aeb7c4 / #b9a6e6 |
| gun-one-man-army | brass | brass finish, two bright lines on the receiver | #d9b25a / #8a5d16 / #fff1b8 |
| gun-one-man-army | hazard | cream with black warning bars | #e7e0cf / #6b6458 / #1a1512 |
| gun-make-my-day | ivory | steel with an ivory grip and cylinder, a gold band | #c9cdd3 / ivory #e6dcc4 / #c08a2c |
| gun-make-my-day | frost | pale icy steel, a blue rib along the barrel | #dbe7f7 / #8ea6c8 / #3f6396 |

That is 14 skins and 28 generations, about US$3 to 4 at medium. The skins must read apart from each other and from the standard gun at 64 px; show each option at 64 px on the sheet too. When the designer picks, the finals go in `docs/art/final/recoil/`, and the orchestrator wires them, together with using the picture for the gun in play.

### Pack 8: Recoil prop master (added 2026-10-03)

Anchor: `docs/games/recoil/style.md`, plus its showpiece sentence: he is seen large and never played with. Context: `docs/games/recoil/prd-v0.6.md` B (the Prop Room) and I.

The Prop Room's shopkeeper is the studio's prop master, an original character: a gruff, friendly 1980s backlot veteran in his fifties. He has a tweed flat cap, round glasses, a big moustache, rolled shirtsleeves, a canvas apron with a pencil and a tape measure in the pocket, and a clipboard. He is lit by the neon pink and teal of the set.

He must not resemble any real actor or film character; the repo is a public website. He is shown waist-up, facing slightly right toward the guns, and cut off at the waist, because the game draws the counter in front of him. Transparent background, 512 x 768. Into `docs/art/final/recoil/`:

| File | Pose |
| --- | --- |
| `prop-master.png` | resting: one hand on the counter edge, the other holding the clipboard, a half smile |
| `prop-master-sold.png` | a purchase: a thumbs-up and a big grin, the clipboard tucked under his arm |

Generate the resting pose first, then use it as the reference image for the second, so he is the same man. Two options each, about US$0.50.

### Pack 9: Recoil director and premiere posters (added 2026-10-05)

Anchor: `docs/games/recoil/style.md`; cast and tone: `docs/games/recoil/world.md`; spec: `docs/games/recoil/prd-v0.7.md` C, E and E2.

- **Director "Big Lou" Marlowe**: an original, loud, kind-hearted 1980s movie director in his fifties, big build, baseball cap, sunglasses pushed up on the forehead, rolled shirtsleeves, a red megaphone. He must not resemble any real director or actor. Waist-up, facing slightly left, transparent background, 512 x 768, neon pink and teal rim light as in Pack 8. Generate `director.png` first (shouting into the megaphone, one arm out), then use it as the reference for `director-approve.png` (megaphone lowered, a big grin and a thumbs-up), so he is the same man. Two options each.
- **Six posters**, 512 x 768, a painted 1980s action-poster look, **no text at all** (the game draws the titles; generated text misspells). One scene each, in the genre joke of its title: `poster-accuracy.png` (Screen Test: The Movie: a lone figure in a spotlight on a soundstage, targets behind), `poster-speed.png` (High Noon-ish: a western street of plywood flats at sunset, a clock tower), `poster-skeet.png` (Saucers Over Burbank: flying saucers that are clearly clay pigeons over a backlot town), `poster-boss.png` (Rubber Suit Rampage: a giant monster that is obviously a man in a rubber suit, crushing a cardboard city), `poster-zombies.png` (Night of the Extras: shambling zombie extras in visible make-up under a full moon, a boom mic in the corner), `poster-endless.png` (The Overnight Shoot: a tired crew under night lights, coffee cups, dawn breaking). The hero is always a silhouette or seen from behind, never a face that could be a real actor. Two options each.

About US$2 to 3. Into `docs/art/final/recoil/`.

### Pack 10: Checkpoint supervisor and plane (added 2026-10-05)

Anchor: `docs/games/checkpoint/style.md`; cast: `docs/games/checkpoint/world.md`; spec: `docs/games/checkpoint/prd-v0.3.md`.

- **Supervisor Pat Okoye**: an original airport security supervisor in her forties, calm and dry, navy uniform shirt with epaulettes, a lanyard with an ID card, reading glasses on a cord, a clipboard and a paper coffee cup. Waist-up, facing slightly right, transparent background, 512 x 768, in the game's flat clean style. `supervisor.png` (briefing: clipboard up, a small knowing smile) first, then `supervisor-proud.png` (arms folded, a warm proud smile) from it as reference. Two options each.
- **The plane**: `plane.png`, a friendly generic twin-engine passenger jet in side view facing right, no airline name, logo or text, a white body with one soft colour stripe, transparent background, 1024 x 384. Two options.

About US$1. Into `docs/art/final/checkpoint/`.

### Pack 11: Ink clients and Rita (added 2026-10-05)

Anchor: `docs/games/ink/style.md`; cast: `docs/games/ink/world.md`; spec: `docs/games/ink/prd-v0.7.md` B to E. **This pack carries the reveal**: the game draws the player's own tattoo onto each portrait, so every image needs a **clear, bare, evenly lit patch of skin, facing the viewer, about a third of the image wide**, on the client's body part, with no tattoo, jewellery, hair or clothing over it.

Six original clients, adults, warm painted look, plain warm-lamp background (not transparent; the reveal fills the card), 768 x 1024, each in three expressions: **happy** (delighted, looking at the patch), **neutral** (polite, unsure), **sad** (disappointed, not angry). Generate happy first and use it as the reference for the other two, so each client is the same person in the same pose; only the face changes.

| Files | Client | Framing that shows the skin patch |
| --- | --- | --- |
| `client-bram-{happy,neutral,sad}.png` | Bram, a weathered sailor in his sixties, knit cap, beard | seated, inner forearm turned up toward the viewer across the lower third |
| `client-theo-{happy,neutral,sad}.png` | Theo, a chef in his thirties, chef's whites with the sleeve rolled | standing, forearm raised and turned out, inner forearm bare |
| `client-june-{happy,neutral,sad}.png` | June, a grandmother around seventy, short silver curls, cardigan slipped off one shoulder | three-quarter back view, looking over the bare shoulder |
| `client-ola-{happy,neutral,sad}.png` | Ola, a bride in her late twenties, a simple off-shoulder top (not a wedding dress) | three-quarter view, bare shoulder and upper arm toward the viewer |
| `client-mina-{happy,neutral,sad}.png` | Mina, a runner in her thirties, running shorts, trainers | seated on the chair, one leg forward, the calf turned to the viewer |
| `client-kai-{happy,neutral,sad}.png` | Kai, a musician in their twenties, headphones round the neck | seen from behind, sitting backwards on the chair, bare upper back, face turned to look over the shoulder |

Plus **Rita**, `rita.png`: the Lucky Needle's owner, an original tattooist in her sixties, silver undercut, reading glasses, arms of faded traditional flash tattoos, a leather apron, arms folded, a proud half smile; waist-up, 512 x 768, transparent background.

Diverse, real-looking people of different builds; no celebrity likeness. One option each for the neutral and sad (from the happy reference), two options for each happy and for Rita. About US$4 to 5. Into `docs/art/final/ink/`. In the handoff, list for each client the skin patch's rectangle in pixels (x, y, w, h) as you see it; the builder measures it again.

### Pack 12: Gravity Golf Mission Control (added 2026-10-05)

Anchor: `docs/games/gravity-golf/style.md`; cast: `docs/games/gravity-golf/world.md`; spec: `docs/games/gravity-golf/prd-v0.11.md`.

- **Dr Sam Ito**, Mission Control: an original, friendly space scientist in their thirties, a headset with a mic, a mission patch on a fleece jacket, a mug with a little planet on it, glowing blue screens of star charts behind. Head and shoulders, 512 x 512, in a round-cornered "video call" frame, deep blue and violet palette. `mission-control.png` (warm smile, leaning to the mic) first, then `mission-control-wow.png` (eyes wide, a hand on the headset, amazed) from it as reference. Two options each.

About US$0.50 to 1. Into `docs/art/final/gravity-golf/`.

### Pack 13: Launch love story (added 2026-10-05)

Anchor: the Pack 5 finals in `docs/art/final/launch/` (same chunky outline, same faces) and `docs/games/launch/style.md`; spec: `docs/games/launch/prd-v0.6.md` D and E. Use the Pack 5 Daifuku and Mochi images as reference images so they are the same characters.

- `daifuku-window.png`: Daifuku sitting on a windowsill of a cosy cottage, a teacup and a strawberry beside, looking out hopefully, a soft pink sky; the window frame visible around. 768 x 768, transparent outside the window frame.
- `mochi-ring.png`: Mochi blushing, eyes shining, holding up in front of him a shimmering pink soda bubble shaped like a ring (with a tiny sparkle), as if proposing. 512 x 512, transparent background.

Two options each, about US$0.50 to 1. Into `docs/art/final/launch/`.

### Pack 14: Gravity Golf, Sam worried (added 2026-10-07)

Spec: `docs/games/gravity-golf/prd-v0.11.md` C2. Use `docs/art/final/gravity-golf/mission-control.png` as the reference image so Sam is the same person in the same frame.
- `mission-control-worried.png`: Sam on the same video call, but the room dimmer and the screens behind showing a red "BUDGET REVIEW" glow (no readable text needed), Sam's brow worried, holding the mug with both hands, still kind. 512 x 512, same frame. Two options, about US$0.30.

### Pack 15: Arena, the arenas and a fighter pilot (added 2026-10-15)

Anchor: `docs/games/arena/style.md`; cast and places: `docs/games/arena/world.md`; rules for fighter art: `docs/adr/0021-cutout-fighter-art.md`. The designer: "the arenas should have art instead of stick men". Write `docs/art/candidates/arena/candidates.json` (ADR-0020) so options can be picked in the game.

**A. Four backdrops** (opaque, 1536 x 768, landscape, behind the sand; the middle band where the fighters stand stays soft and low in contrast; no people in the foreground):

| File | Arena | Look |
| --- | --- | --- |
| `arena-pit.png` | The Pit, Capua | a small rough provincial ring: a wooden fence, packed sand, a few rows of rough wooden stands, banners of cloth, late afternoon |
| `arena-city.png` | The City arena, Pompeii | a stone amphitheatre: arches, colourful painted banners, Vesuvius faint in the distance |
| `arena-colosseum.png` | The Colosseum, Rome | the vast Colosseum interior: tiers of arches, the canvas awning overhead, a crowd as soft shapes, golden light |
| `arena-grand.png` | The Grand Games, Rome | the Colosseum dressed for the Emperor: gold and purple hangings, the imperial box at the top centre, rose petals in the air |

**B. The fighter pilot: one cut-out kit** (transparent PNG; each part a separate image, in side view facing right, the same lighting and scale across all parts, painted to fill a plain rectangle-ish silhouette with rounded joint ends so the parts overlap cleanly when rotated; no armour painted on the body):

| File | Part | Size |
| --- | --- | --- |
| `kit-base-head.png` | the head, bare, short dark hair, a determined face in profile | 256 x 256 |
| `kit-base-torso.png` | the torso from neck to hips, bare-chested with a leather belt and a simple cloth kilt hanging from it | 384 x 512 |
| `kit-base-upperarm.png` | the upper arm, shoulder end at the top | 160 x 320 |
| `kit-base-forearm.png` | the forearm with the hand gripping (a fist with a hole for a hilt), elbow end at the top | 160 x 320 |
| `kit-base-thigh.png` | the thigh, hip end at the top | 192 x 352 |
| `kit-base-shin.png` | the shin with a sandalled foot pointing right, knee end at the top | 192 x 384 |
| `kit-helmet-gallic.png` | a bronze gladiator helmet with a crest, to sit over the head | 256 x 256 |
| `kit-shield-round.png` | a round bronze-rimmed wooden shield, face-on | 320 x 320 |

Make the kit from one first image (the torso) as the reference for the rest. Make two options for the backdrops and one for each kit part (a kit is a set; swap the whole set if it doesn't hang together). About $3 to $4. Put everything into `docs/art/final/arena/`, and the second backdrop options as `-alt` files. In the handoff, list each part's joint points in pixels (for example the shoulder and elbow centres on the upper arm), so the builder can pin them to the rig.

### Pack 17: Arena, the faces (added 2026-10-18)

Anchor: `docs/games/arena/style.md`; cast and lines: `docs/games/arena/world.md`; spec: `docs/games/arena/prd-v0.3.md`, "Step 6". The designer: "It needs more art." Portraits are not hit-tested, so they follow ADR-0015 as is. Add them to `docs/art/candidates/arena/candidates.json` with Pack 15.

Portraits, 768 x 1024, chest up, three-quarter view facing left (toward the player, who stands on the left), a plain warm sand-coloured background with a soft vignette, no text:

| File | Who | Look |
| --- | --- | --- |
| `brutus.png` | Old Brutus, the lanista and your trainer | a grizzled ex-gladiator in his sixties, broken nose, cropped grey beard, a scarred forearm across his chest, a plain wool tunic; gruff and dry |
| `brutus-proud.png` | Old Brutus, proud | the same man, a rare half-smile he is trying to hide |
| `champ-marcus.png` | Marcus the Red | a red-haired murmillo, crested bronze helmet under his arm, mocking grin |
| `champ-aurelius.png` | Aurelius the Golden | a handsome vain champion, gilded armour, golden laurel, smug |
| `champ-flamma.png` | Flamma the Unbroken | a scarred veteran, many old wounds, calm and dangerous |
| `champ-varro.png` | Varro of Capua | a huge local hero, shaved head, thick neck, heavy plate, confident |
| `champ-twins.png` | Castor and Pollux, the Twins | two identical young men side by side, matching blue-trimmed armour, one smiling, one serious |
| `champ-hermes.png` | Hermes the Swift | a lean wiry runner, winged motif on a light helmet, a sly look |
| `champ-carpophorus.png` | Carpophorus the Beastmaster | a broad bearded beast handler in leather, a lion's head beside him at his hip, its mane in frame |
| `champ-mevia.png` | Mevia the Huntress | a fierce woman hunter, braided hair, a net over one shoulder and a spear |
| `champ-aquila.png` | Aquila, the Emperor's Blade | a tall immaculate champion in polished steel and a purple cloak, an eagle on the breastplate, cold |
| `emperor.png` | the Emperor, in the imperial box | an older emperor in purple and gold with a laurel wreath, seated, one hand raised with the thumb hidden, unreadable |

Generate `brutus.png` first and use it as the reference for `brutus-proud`. Make two options for Brutus, Marcus, Castor and Pollux and the Emperor, and one for each of the others. That is 16 images, about US$3 to 4. Finals go into `docs/art/final/arena/`.

### Pack 18: Arena, the muscle tiers (added 2026-10-18)

Spec: `docs/games/arena/prd-v0.3.md`, "Step 6 addition: Strength shows in the muscles". The designer wants a fighter's Strength to show in the art: lean, average or muscular.

Use the delivered kit parts (`docs/art/candidates/arena/kit-base-*-A.png`, the muscular tier) as the reference for each image. Each new part must keep exactly the same canvas size, pose, outline weight, lighting, skin tone and joint positions as its muscular reference, so it swaps in place on the rig. Only the muscle changes:
- **lean:** wiry and thin, little muscle definition, a narrower silhouette inside the same joint ends;
- **avg:** fit and ordinary, light definition.

| Files | Part |
| --- | --- |
| `kit-base-torso-lean.png`, `kit-base-torso-avg.png` | the torso, with the same belt and kilt |
| `kit-base-upperarm-lean.png`, `kit-base-upperarm-avg.png` | the upper arm |
| `kit-base-forearm-lean.png`, `kit-base-forearm-avg.png` | the forearm, with the same bracer and fist |
| `kit-base-thigh-lean.png`, `kit-base-thigh-avg.png` | the thigh, with the same kilt edge |
| `kit-base-shin-lean.png`, `kit-base-shin-avg.png` | the shin, with the same sandal |

That is 10 images, one option each (the reference keeps them consistent), about US$2. Add them to `docs/art/candidates/arena/candidates.json` as their own assets, with `-A` files as before, and add a row to `sheet-kit.png` (or a new `sheet-kit-tiers.png`) showing lean, avg and muscular side by side for each part.

### Pack 19: Arena, the beasts and the gear (added 2026-10-18)

Anchor: `docs/games/arena/style.md`; rules: `docs/adr/0021-cutout-fighter-art.md` (accepted 2026-10-18); spec: `docs/games/arena/prd-v0.3.md`, "Step 6b". The designer, on the pilot: "It looks like there's still some art missing, like sometimes you show the stick man." Use the delivered kit (`docs/art/candidates/arena/kit-*-A.png`) as the style and scale reference. Every part is a transparent PNG, side view facing right, with the same lighting and outline weight. Add every asset to `docs/art/candidates/arena/candidates.json`, and make one contact sheet, `sheet-beasts-gear.png`.

**A. The two beasts, cut-out kits** (each part separate, rounded joint ends so parts overlap when rotated; no blood):

| Files | Part | Size |
| --- | --- | --- |
| `beast-lion-body.png`, `beast-bear-body.png` | the body from shoulders to rump, no legs, no head (the lion's tail separate) | 640 x 384 |
| `beast-lion-head.png` (with the mane), `beast-bear-head.png` | the head in profile, neck end at the left | 320 x 320 |
| `beast-lion-upperleg.png`, `beast-bear-upperleg.png` | an upper leg, body end at the top | 160 x 288 |
| `beast-lion-lowerleg.png`, `beast-bear-lowerleg.png` | a lower leg with the paw pointing right, knee end at the top | 160 x 288 |
| `beast-lion-tail.png` | the lion's tail with its tuft, root end at the left | 320 x 160 |

**B. Gear, to be drawn over the kit:**

| Files | Piece | Size |
| --- | --- | --- |
| `kit-helmet-murmillo.png` | a broad-brimmed bronze helmet with a fish crest and a grille visor | 256 x 256 |
| `kit-helmet-thraex.png` | a Thracian helmet with a griffin crest and a tall plume | 256 x 256 |
| `kit-helmet-secutor.png` | a smooth round egg-shaped helmet with two small eye holes | 256 x 256 |
| `kit-galerus.png` | a retiarius's tall shoulder guard, worn on the left shoulder | 192 x 256 |
| `kit-shield-scutum.png` | a tall curved rectangular shield, red with a bronze boss, side-on | 224 x 448 |
| `kit-shield-parma.png` | a small round buckler, face-on | 224 x 224 |
| `kit-plate-chest.png` | a bronze chest plate to sit over the torso | 320 x 320 |
| `kit-plate-manica.png` | a segmented arm guard (manica) over a forearm | 160 x 320 |
| `kit-plate-greave.png` | a tall bronze greave over a shin | 192 x 384 |
| `kit-wrap-trousers.png` | padded cloth leg wraps over a thigh, for the gladiator types who wear them | 192 x 352 |

That is 19 images, one option each, using the kit as the reference, about US$5 to 6. Put them in `docs/art/candidates/arena/` with `-A` files, as Pack 15.

### Pack 16: Ink, Ines, Arlo and Rita's finale (added 2026-10-12)

Anchor: `docs/games/ink/style.md`; cast: `docs/games/ink/world.md`; spec: `docs/games/ink/prd-v0.8.md` C and D. The same rules as Pack 11: a **clear, bare, evenly lit patch of skin facing the viewer, about a third of the image wide**, on the client's body part, with no tattoo, jewellery, hair or clothing over it. Use a Pack 11 final (for example `docs/art/final/ink/client-june-happy.png`) as the style reference so the new clients match the six.

Two new clients, 768 x 1024, a plain warm-lamp background, each in three expressions: happy (delighted, looking at the patch), neutral (polite, unsure) and sad (disappointed, not angry). Generate happy first and use it as the reference for the other two.

| Files | Client | Framing that shows the skin patch |
| --- | --- | --- |
| `client-ines-{happy,neutral,sad}.png` | Ines, a firefighter in her fifties, short grey-streaked hair, a fire-service T-shirt with one sleeve rolled high | three-quarter view, bare shoulder and upper arm toward the viewer |
| `client-arlo-{happy,neutral,sad}.png` | Arlo, a gentle man of eighty, cardigan and shirt sleeve rolled, a wedding ring, slightly nervous | seated, inner forearm turned up toward the viewer across the lower third |

**Rita for the finale:** use `docs/art/final/ink/rita.png` as the reference, so she is the same woman. 768 x 1024, warm-lamp background. She sits in the client's chair, one sleeve rolled to show a **clear bare patch on the inner forearm** among her faded flash tattoos.
- `rita-proud.png`: moved and proud, eyes a little wet.
- `rita-kind.png`: kind and encouraging, a small smile.

That is 8 images. Use one option each for the neutral, sad and kind images (from the happy or proud reference), and two options for each happy and for `rita-proud`. About US$2 to 3. They go into `docs/art/final/ink/`. In the handoff, list each portrait's skin patch rectangle in pixels (x, y, w, h).

## Handoffs from the orchestrator (2026-10-03)

The designer pastes the orchestrator's one-line task into the art chat. (A Routine bound to the art chat was tried and does not reach it: each firing starts a new empty session.) The art session replies with a pushed `docs/art/HANDOFF-<topic>.md`, which the orchestrator reads when it pulls.

## Process

1. Generate **three options** per asset at medium quality (cheap), into `docs/art/candidates/<slug>/` (not under `games/`).
2. Write **`docs/art/candidates/<slug>/candidates.json`** for the pack (ADR-0020): `{ "pack": "<n>", "assets": { "<asset-name>": ["<asset-name>-A.png", "<asset-name>-B.png"] } }`, with the asset names the game uses (the file names in the pack table, without extension). The designer can then pick in the game itself, from the ART tab on the menu (dev channel), and paste you a line like "Art picks, launch, pack 13: daifuku-window B, mochi-ring A". Also make one **contact sheet** per pack (a single PNG grid with each option labelled, for example "gun-pulse-rifle A / B / C") at `docs/art/candidates/<slug>/sheet.png`, commit and push, and give the designer its link: `https://yohannabittan.github.io/Game-design/docs/art/candidates/<slug>/sheet.png` (the branch is published by GitHub Pages; allow a minute after the push).
3. When he picks, regenerate only the picks at high quality if needed, save them to `docs/art/final/<slug>/` with the file names above, delete the unpicked candidates, update the ledger, commit and push.
4. Tell the designer it is ready for wiring, and that the orchestrator session builds it into the game (he can tell that session: "the art pack for <game> is in docs/art/final/<slug>").

## Git

- Branch: `claude/flash-game-dev-process-v7yrbe` only; never another branch, never a pull request.
- Push with `git push -u origin claude/flash-game-dev-process-v7yrbe`; on a network error retry up to four times with backoff (2, 4, 8, 16 s).
- Commit only `docs/art/` and `docs/assets-ledger.md`. Another session may have uncommitted game work in its own container; you are in a fresh container, so pull first (`git pull origin claude/flash-game-dev-process-v7yrbe`) and keep your commits to those paths.
- End every commit message with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
  and the `Claude-Session:` line for your own session.
