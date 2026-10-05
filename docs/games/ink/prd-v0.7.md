# Ink PRD v0.7: someone wears your work forever

Status: locked 2026-10-05 from the story plan the designer approved (`docs/story-plan.md`, Ink; the reveal is Elaina's idea). Builds on v0.6 and its rounds. Cast: `docs/games/ink/world.md`. Drive: care and trust. Needle, timers, stars (out of 5), slips and badges do not change. **Build after Pack 11 lands**: the reveal needs the client portraits.

## A. The cold open (first launch only)

- Two cards, one tap each, "Skip" always visible (44 px), replayable from a "Story" button on the menu:
  1. "A tattoo lasts a lifetime."
  2. "Every client trusts your hand with theirs."

## B. The client of the day

- Each stencil belongs to one client, whose portrait and line show on the play intro (where the stencil's name shows now), small enough never to sit under the thumb:

| Client | Body part | Stencils and their lines |
| --- | --- | --- |
| Bram | forearm | Circle "Something simple. My first." / Anchor "An anchor for my first voyage." |
| Theo | forearm | Key "The key to my first restaurant." / Trinity "Three knots: me, my wife, my kitchen." |
| June | shoulder | Rose "My grandchildren dared me." / Swallow "A swallow always comes home." |
| Ola | shoulder | Diamond "Something new, for the wedding." / Star "My wife calls me her star." / Constellation "The sky the night we met." |
| Mina | calf | Heart "For my mum, who never misses a race." / Bolt "Fastest on the team. Prove it." / Dagger "Hill sprints. Every week." / Skull "Survived the mountain race." / Bones "Two broken legs, still running." |
| Kai | back | Crescent "The moon from our first album." / Halo "For my band. We're angels. Ish." / Clover "Lucky, for the tour." / Snake "Tour starts Monday. Make it count." |

- The daily stencil has no client (it stays as now).

## C. The reveal (Elaina's idea)

- After the finish, before the stars, the view **zooms out from the skin to the client**: over about 1.2 s the piece (your actual ink, slips included) shrinks into the skin patch on that client's portrait, and the portrait fills the card. A tap skips straight to the end.
- The client's face reacts to your result: **happy** at 4 or 5 stars, **neutral** at 2 or 3, **sad** at 0 or 1 or a failed piece. One line under it from a small pool: happy "I love it. Thank you.", "It's perfect."; neutral "It's... good. Thanks."; sad "Oh. Well. It's done now."
- The portrait's skin patch rectangle comes from a small data table per portrait (measured from the final art by the builder), so the tattoo sits where the skin is. The piece is drawn into it with a slight multiply blend so it reads as ink on that skin.
- The stars, badge reveal and buttons follow as now.

## D. Rita and the ladder

- The ladder stays quietly in the background, from total stars: Apprentice → Artist (at 25) → Master (at 60). A rank-up card with Rita's portrait (Pack 11 `rita.png`) shows once per rank: Artist "Clean lines. You'll do. Chair two is yours." / Master "Your own shop. Your name on the door."
- The menu shows the rank name small under the title.

## E. The portfolio (payoff)

- The gallery (missions screen) gains a **Portfolio** page: each stencil's best piece shown on its client's portrait, using the stored best (redrawn from the stored ink result if the game keeps it; otherwise a perfect fill of the stencil on the client, marked with its best stars).

## F. Art

- Pack 11: six clients × happy / neutral / sad, plus Rita, from the Artist into `docs/art/final/ink/`. Wire as webp in `games/ink/assets/`. Until art lands nothing in C or E ships; the layer waits.

## G. Saves

- `saveVersion` 10 adds `openSeen` and `rankSeen`. If the portfolio needs each best piece's ink, store it compactly (a coverage bitmap per stencil, under a few kilobytes in total) or use the fallback in E. `migrate`: any played save marks `openSeen` and sets `rankSeen` to the current rank (no cascade).

## H. Out of scope

New stencils, timers or rules; voice; changes to the needle, slips, badges or skins.

## I. Acceptance

- Text counts per principle 11 on the intro, the reveal and the rank card.
- The reveal skips in one tap and never delays the retry button by more than one tap.
- A v9 save migrates with no cold open and no rank card cascade.
- The tattoo sits inside the skin patch on all 18 portraits (screenshot sheet).
- `npm run smoke` passes; the play frame is not slower than ink-v27.
