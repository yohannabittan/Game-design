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
- **Budget: US$40 total** on the OpenAI account (first pass $15, raised to $25, then by $15 to $40 by the designer on 2026-10-03), unless the designer raises it again. The provider cap is $50.
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

## Handoffs from the orchestrator (2026-10-03)

The designer pastes the orchestrator's one-line task into the art chat. (A Routine bound to the art chat was tried and does not reach it: each firing starts a new empty session.) The art session replies with a pushed `docs/art/HANDOFF-<topic>.md`, which the orchestrator reads when it pulls.

## Process

1. Generate **three options** per asset at medium quality (cheap), into `docs/art/candidates/<slug>/` (not under `games/`).
2. Make one **contact sheet** per pack (a single PNG grid with each option labelled, for example "gun-pulse-rifle A / B / C") at `docs/art/candidates/<slug>/sheet.png`, commit and push, and give the designer its link: `https://yohannabittan.github.io/Game-design/docs/art/candidates/<slug>/sheet.png` (the branch is published by GitHub Pages; allow a minute after the push).
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
