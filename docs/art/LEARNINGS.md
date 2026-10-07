# Art session learnings

Consolidated 2026-10-03 from the sessions that made Packs 1 to 8 for five games: about 420 generated images, $24.44 of the $40 budget by the ledger, 130 kept rows. ADR-0015 and `BRIEF.md` still win; this file is what the work taught. Dollar figures are estimates (see Cost).

## Access and limits
- The key is injected by the proxy for api.openai.com. There is no `OPENAI_API_KEY` variable to check; test access with `GET /v1/models`. Never print or write a credential.
- Use `gpt-image-1.5`. `gpt-image-2` rejects `background=transparent` ("not supported for this model"). `gpt-image-1` is listed with a shutdown date of 2026-10-23.
- Limit: 5 images per minute for the organisation, counted by `n`. Parallel jobs collide ("try again in Ns"). Run one job at a time and retry on `rate_limit_exceeded` after the stated wait. A 2-image call takes about 15 s; a 16-job batch about 16 minutes. Two batches at once only slow each other.
- `n=2` now and then returns one image (neutron star, explosives). Count the files and ask again for the missing option.
- The safety filter refused a "putty explosive with a detonator" (`safety_violations=[illicit]`). A refusal costs nothing. A cartoon prop (red sticks, a fuse, a clock) passed.
- The edits endpoint takes `image[]` references up to 1024x1536, an optional mask, and `background=transparent`.
- Long batches: run in the background, write output to a file, read it when notified.

## Prompts that worked
- Shape: style anchor verbatim, then the game's showpiece sentence if the asset is purely visual, then the subject, then the spec (transparent or opaque, size). Nothing else.
- The prompt is the lever, not the quality setting. Black hole, four ways: plain prompt at high ($0.18) was the same cartoon as at medium; a long specific prompt at medium ($0.06) gave a swirling disc, embers and dark lanes. Medium was enough for everything shipped.
- Rich subjects name materials, layers, light and particles. Keep the silhouette sentence ("same crisp chunky silhouette") so detail does not eat the shape.
- Ask for the face every time: "a bold, clearly drawn cartoon face with two big bright eyes and a mouth, readable even when tiny". Without it about a quarter of options came back faceless.
- Describe a recurring character identically in every prompt. That kept Mochi consistent where reference images did not.
- Hard colour rules beat adjectives: "main metal exactly #cfd4da, accent exactly #d6a23a used only for the plate; no pink, no teal, no camouflage" worked. "Nickel" alone gave neon camo.
- Say "fully opaque solid body" for white or pale subjects; both Daifuku rounds had see-through bodies without it.
- Say "facing right" and check: 5 of 18 first-pass guns faced left (mirror in post).
- More options means new concepts (teacup versus trajectory tangle), not the same prompt again.
- Before a big batch, test one asset four ways for about $0.43. It paid for itself on the ranks.

## What the generator cannot do
- Small text. The Recoil tagline was wrong in four of five medium attempts ("RRODUCTION", "Backlot 39"). Big display words (RECOIL, INK, GRAVITY GOLF) are usually right, but one INK option read as a different word. Erase small text and have the game draw it.
- Exact repaints. A reference edit with no mask paints a scene round the object or copies it. With a mask it holds the placement but redraws the object: outline match to the standard gun was 75 to 89 percent for pistols and revolvers, 60 to 79 for the SMG and rifle, 5 to 36 for long guns.
- Reference edits for new expressions and new badge symbols returned the source twice. One exception: Prop Master's second pose kept the same man when the instruction said "change only his pose", forbade props ("no money"), and avoided the word "purchase", which made it paint cash.
- A clean cut-off. "Cut off at the waist" gives an outlined sticker edge or a ragged one; the game's counter must cover it.
- Opaque icons sometimes draw their own rounded tile inside the square. Crop to the tile.
- Shadows and ground ellipses appear despite "no shadow". Prefer options without.

## Post-processing (Pillow and numpy)
- Trim with alpha above 40. Glow spans the canvas, so alpha above 0 gives a full-frame box.
- Size for the screen at 3x, fit into a square canvas centred. Rich 512 px emblems are about 500 KB each as PNG.
- Defect checks that caught real problems: semi-transparent share inside the sprite box (under 1 percent is sound, over 3 is see-through); outline match and overhang against the standard picture; alpha arrays equal for repaints.
- Palette repaint: keep the alpha channel byte for byte, classify pixels by role (outline, rim light, grip, tip, body), remap the body by luminance. `docs/art/recolor-gun.py` is the frost recipe. It keeps the silhouette exact and cannot add details.
- Erase text by inpainting its box from the surroundings with a normalised blur. Deleting the rectangle leaves a hole.
- Mirror left-facing sprites; check the result.

## Character sets (Packs 9 to 12)
- A same-person set works as: generate the base pose, then edit it with the base as the reference ("redraw the same man ... change only the pose and expression"), two takes each, and keep the take whose body drifts least from the base (a mean grey difference over the body area, about 35 levels for expressions). Mina's pair barely moved; Bram's neutral sat 68 px lower. A builder that places something on the body must measure each image, never the set.
- Reference edits fail in three ways: they invent a prop ("purchase" painted cash, fixed by "no money, no papers"), they lose the background (Sam's amazed pose went transparent, fixed by restating the blue screens in the prompt), and they barely change ("change only X" needs a strong, specific X). Retry with the failure named.
- A masked edit of just the face changed the person (a younger man with a dark beard). The plain edit kept him. Do not use a mask to change an expression.
- The Checkpoint anchor describes an X-ray of an object, so on a person it gave a photograph. Characters in games whose anchor is about objects need a short cast sentence in the game's palette (recorded in the ledger).
- A bare skin patch needs words for what must be absent: "one uniform flat skin tone, no lighter rectangle, no tan lines, no marks". Without them Kai's back got a pale rectangle painted on it, Mina's calf came out small and diagonal, and a bride's top read as a towel. Check every patch by overlaying a rectangle; the first sets of three needed redoing.
- No-text posters worked: say "no letters, numbers, logos, title lettering or credits", and that a clock face and a clapperboard are blank. Keep the hero a silhouette from behind so no face can resemble an actor.
- Safe batches: a script that dies on an empty API response loses the queue (it happened once), so retry on a bad body. Never `pkill -f` a pattern that also matches the shell running the command; use `pgrep -f "[x]yz"`. Queue batches behind a running one with an `until ! pgrep` loop.
- A new scene for an existing character (Pack 13) worked with the character image as the reference when the prompt restated the character in words, described every object in the scene, and asked for the cut-out edge as "a single object cut out like a sticker with a plum outline all around its edge". The first round, which only said "transparent outside the window frame", came back opaque. Name a feature the reference lacks (an arm holding a ring) in the prompt or the model invents one: Mochi grew two small stubs. Check the corners' alpha after every transparent generation.
- Candidates for 36 portraits: WebP at quality 95 is about 0.37 MB each against 1.5 MB as PNG; a 36-image sheet is a 1.2 MB JPEG.

## Working with the designer
- He picks on one numbered sheet: columns "current | A | B", every option also at 64 px, because thumbnails decide. He circles in green on a downsized screenshot. Read the circles by detecting green per row and column, then check any close row on an enlarged crop.
- Tastes shown: richer detail for purely visual things (titles, icons, medals, ranks); flat and matched to the procedural drawing for anything played with; a face on every character emblem; spheres for stars but he likes the pointed white dwarf; parody and jokes (a towel, a teacup, dice). When he says "just pick", choose the clearest silhouette at 64 px.
- Tasks arrive as a line pasted from the orchestrator. Reply with a pushed `HANDOFF-<topic>.md`. Send the sheet in chat as well as the Pages link, which lags a minute.
- Chat scales an image taller than 8000 px. Keep sheets to 14 or 16 rows.
- Say how much budget a job will use and how much is left when it matters.

## Git and ledger
- Commit only `docs/art/` and `docs/assets-ledger.md`. Pull with rebase before every push because the orchestrator pushes meanwhile. Retry pushes with backoff. A stop hook complains about uncommitted files, so commit after each deliverable.
- Ledger: one row per generated image (kept, discarded, superseded, or derived at no cost) with path and full prompt, written by a script from the generation log so none is forgotten. Fix statuses by hand afterwards.
- After a pick: move to `docs/art/final/<slug>/` under the brief's file name, delete every unpicked candidate, mark the rows, push.
- A handoff note separates decided from proposed, lists the files, says what wiring must handle, and ends with one line for the designer to paste.
- Replacing a file in `docs/art/final/` changes nothing in the game: wiring converted copies into `games/<slug>/assets/` (for Recoil, trimmed WebP plus tip numbers in `GUN_PIC`). Every replacement needs a re-wire note. Frost was replaced and still showed the old pistol until the designer noticed.

## Cost (ledger estimates)
- Medium: about $0.058 per 1024x1024 image and $0.08 per 1536x1024 or 1024x1536, so a pair is $0.12 to $0.17. High is about $0.18 for a square.
- Estimates use the usage block at $40 per million output tokens, an upper bound. The billing page is the truth.
- By game: gravity-golf $11.08, checkpoint $6.55, recoil $4.55, launch $1.75, ink $0.51.
- By outcome: kept $7.23, discarded $15.61, superseded $1.27. About two thirds of spend went on options not kept; that is the price of letting him choose.

## What I would do differently
- Write the rich prompt first. The plain rank ladder ($2.59) and the plain titles, icons and medals ($1.27, now superseded) were redone: about $3.90.
- Test one asset against each known failure (reference edit, mask, small text, faces) before the batch. Pack 7 took three rounds, about $2.20 in the ledger, to reach a technique that works.
- Put faces, opaque body, facing right and no small text in the first prompt.
- Save at the size the game draws at 3x and compress (WebP or palette PNG) before committing. The final folders are over the 1.5 MB per-game cap: gravity-golf 9.7 MB, checkpoint 4.0, recoil 3.8, ink 2.2, launch 2.0. The wiring layer has to shrink them.
- Ask for the pick on a whole pack at once, with the sheet in the game's own order.
