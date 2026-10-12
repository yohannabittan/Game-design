# Ink PRD v0.8: the book fills up

Status: locked 2026-10-12 by the designer ("Perfect", the full set). It builds on v0.7 and its C2.

**What the designer said:** "We also need more tattoo content at this point."

**What v0.8 adds:** 13 new stencils (18 become 31), in four strands:
- regulars who come back;
- lettering;
- two new clients;
- Rita's finale.

**What doesn't change:** the needle, slips, landings, timers by the path rule, stars, badges and skins.

## A. The regulars come back (6 stencils, no new art)

Each client returns for a second piece. The new piece goes on the same body part, so it uses the client's existing portraits and patch.

| # | Client | Stencil | Their line on the intro |
| --- | --- | --- | --- |
| 19 | Bram | **Lighthouse** | "Made it back. A lighthouse, for the way home." |
| 20 | Theo | **Knife and Fork** (two crossed parts) | "One year open. Still full every night." |
| 21 | June | **M and J** (lettering in a heart, B) | "My grandchildren, Max and Jo. Right here." |
| 22 | Ola | **Two Rings** (linked, two parts) | "One year married. She still calls me her star." |
| 23 | Mina | **Winged Shoe** | "First marathon. Mum was at the finish." |
| 24 | Kai | **ENCORE** (lettering on a banner, B) | "The album's out. They want an encore." |

- **Your earlier work stays on their skin.** On a returning client's reveal and on their Portfolio entry, each earlier piece of theirs that you have finished is drawn small and faded beside the new one. Earlier pieces are drawn as perfect fills of their stencils, as the Portfolio's fallback. They sit in a second patch per portrait, which the builder measures next to the first.
- **If a portrait has no second clear patch,** the earlier pieces are skipped there (the simplest option).

## B. Lettering, a new kind of piece

- **A lettering stencil is a word:** each letter is its own part, made of thin strokes, often on a banner or in a heart. The existing parts and landings rules make it a real skill: every letter is a new touch-down, so a clean landing matters.
- **A tool makes the shapes.** `tools/ink-letters.mjs` turns a word into stencil polygons from a small hand-made single-stroke alphabet (A to Z, plus "&") at a stroke width and a slant. The output is the README's stencil JSON. It is reused for every future name.
- **Timers** come from the path rule (`--timer-from-path`), as for every stencil.

## C. Two new clients (6 stencils, Pack 16)

| # | Client | Stencil | Their line |
| --- | --- | --- | --- |
| 25 | **Ines**, a firefighter in her fifties, on her last week (shoulder) | **Flame** | "Twenty years. I'm keeping one flame." |
| 26 | Ines | **Crossed Axes** | "For the crew. Station 9." |
| 27 | Arlo, 80, his first tattoo (forearm) | **Rose** (a fuller rose than #10) | "My first, at eighty. For Elsie." |
| 28 | Arlo | **ELSIE** (script on a banner, B) | "Sixty years married. Her name, in her hand." |
| 29 | Ines | **Phoenix** (boss) | "Last shift done. Now I rise." |
| 30 | Arlo | **Forget-me-not** | "So I never do." |

The reveal faces and lines work as in v0.7: happy at 4 or 5 stars, neutral at 2 or 3, sad at 0 or 1.

## D. The finale: Rita's swallow (1 stencil)

- **#31 Swallow for Rita** (final). It opens when every other stencil has at least one star.
- **Before it, a two-beat card.** Rita (`rita`) sits down in your chair and rolls up her sleeve:
  1. "My hands have been shaking for a year. You noticed."
  2. "One more piece, then. On me."
- **Her reveal faces:**
  - at 4 or 5 stars, `rita-proud`: "A swallow always comes home. So does this shop. It's yours.";
  - at 3 stars or fewer, `rita-kind`: "Steady. Try again, I'm not going anywhere."
- **After the first 4-star finish,** the menu's rank line reads "The Lucky Needle, yours".

## E. Order and unlocks

- The new stencils are appended as #19 to #31 in the order above. Saves are keyed by index, so appending needs no remap.
- Each opens as the one before it is finished, as now. The finale opens as in D.

## F. Saves

`saveVersion` 11 adds:
- `ritaSeen` (the finale card has shown);
- `shopYours`.

`migrate` sets both false. Bests for #0 to #17 are unchanged.

## G. How it is built (cost before rigour, in parallel)

- **One builder (Sonnet):** A's earlier-work drawing, D's card and faces, the menu line, E and F, and wiring the Pack 16 portraits with their patch tables as they land. It never authors stencils.
- **Content shards (Sonnet):** each produces stencil JSON files and their sim-ink proofs, and never touches `game.js`, so they run beside the builder:
  1. #19, #20, #22 and #23;
  2. the `ink-letters` tool, then #21, #24 and #28;
  3. #25, #26, #27, #29, #30 and #31.
- **Lean checks per stencil:** inside the reachable area, the timer from the path, a perfect path finishing, and a quick noisy run for the star spread. No search longer than about two minutes.
- **The orchestrator pastes the JSON into STENCILS** and runs one reviewer for the whole batch.
- **Art:** the art chat makes Pack 16 at the same time. Until it lands, the new clients show a drawn fallback face, so the content can ship first.

## H. Out of scope

- colour inks;
- new needle rules;
- multi-session pieces;
- voice.

## I. Acceptance

- 31 stencils.
- The lettering stencils are made by the tool.
- Every new timer comes from the path rule.
- Earlier pieces show on returning clients.
- The finale opens and plays as in D.
- The new clients' fallbacks draw until Pack 16 lands.
- A v10 save migrates.
- `npm run smoke` passes.
- Frame time is no worse than ink-v29.
