# Gravity Golf PRD v0.11: a probe looking for life

Status: locked 2026-10-05 from the story plan the designer approved (`docs/story-plan.md`, Gravity Golf; "Yeah good plan but don't execute until usage refreshes"). Builds on v0.10. Cast: `docs/games/gravity-golf/world.md`. Drive: curiosity and discovery. Rules, physics, holes, badges and stars do not change.

## A. The cold open (first launch only)

- Two still cards over the starfield, one tap each, "Skip" always visible (44 px), replayable from a "Story" button on the menu:
  1. "Humanity built you to answer one question."
  2. "Are we alone? Ride the gravity. Find out."

## B. Mission Control on the result card

- Dr Sam Ito's portrait (Pack 12; a headset glyph fallback) and one line on each end card, cosmetic (`Math.random`):
  - **3 stars:** "Clean assist. Data received.", "Textbook. The team is cheering.", "Beautiful line, Lumen."
  - **2 stars:** "Got there. Data received.", "Solid. One stroke to spare next time?"
  - **1 star or worse:** "We'll call that a scenic route.", "Still flying. That's what counts."
  - **An Expert fourth star:** "No guide lines? Show-off."
- **First arrival in each sector** replaces the line once with its log:
  - Starfield: "Log: rocks and starlight. No life."
  - Nebula: "Log: gas and dust. No life. Yet."
  - Meteor shower: "Log: ice and rock at speed. No life."
  - Deep space: "Log: dark and quiet. No life."
  - Binary sunrise: "Log: two suns, warm planets. Still no life."
  - Galactic Core: "Log: crowded, bright, loud. Listening..."

## C. The Probe Log: true facts

- The first time a finished hole contains a kind of body, enters a sector, or reaches a rank, Mission Control adds one fact under the line (smaller type, at most two lines) and saves it to a **Probe Log** page on the missions screen, in the order collected, with uncollected ones as "???".
- At most one fact per end card; if two are due, the second waits for the next card.
- The facts (the reviewer checks each against a general reference):

| Key | Fact |
| --- | --- |
| first hole | "Voyager 2 used gravity assists to visit all four giant planets." |
| planet | "Planets don't shine; they reflect their star's light." |
| moon | "Our Moon shows Earth one face: it spins once per orbit." |
| sun | "The Sun holds over 99% of the mass in our solar system." |
| binary | "Many stars come in pairs, circling a shared centre." |
| black hole | "Not even light escapes past the edge, the event horizon." |
| comet | "A comet's tail points away from the Sun, blown by sunlight." |
| Nebula sector | "Nebulae are clouds of gas and dust where stars are born." |
| Meteor shower sector | "A meteor shower is Earth crossing a comet's dust trail." |
| Deep space sector | "Light from far galaxies left them millions of years ago." |
| Binary sunrise sector | "Real planets circle two suns; Kepler-16b was found in 2011." |
| Galactic Core sector | "Our galaxy's centre holds a black hole of four million Suns." |
| Moon rank | "Ganymede, a moon of Jupiter, is bigger than Mercury." |
| Planet rank | "Earth is the only planet known to have life. So far." |
| Giant Planet rank | "All the other planets could fit inside Jupiter." |
| Brown Dwarf rank | "Too big to be a planet, too small to shine like a star." |
| Red Dwarf rank | "Red dwarfs are the most common stars in our galaxy." |
| Yellow Star rank | "Our Sun is a yellow dwarf, about 4.6 billion years old." |
| Blue Star rank | "Blue stars are the hottest; red ones are the coolest." |
| Red Giant rank | "In about 5 billion years, our Sun will swell into a red giant." |
| Blue Giant rank | "Blue giants burn out in millions of years, not billions." |
| White Dwarf rank | "A white dwarf packs a Sun's mass into an Earth-sized ball." |
| Supernova rank | "Exploding stars made much of the iron in your blood." |
| Nebula rank | "The Crab Nebula is left from a star seen exploding in 1054." |
| Neutron Star rank | "A teaspoon of neutron star weighs billions of tonnes." |
| Quasar rank | "A quasar can outshine every star in its galaxy combined." |
| Black Hole rank | "In 2019 we saw our first picture of a black hole's shadow." |

## D. Ranks get a line

- The existing rank-up card adds the rank's fact (it is that rank's Probe Log entry), so a rank is "what Lumen has learned to bend around".

## E. The signal

- Clearing hole 30 (Sagittarius) for the first time, with any stars, shows a card after the end card: a slow pulsing waveform and "A signal. Not natural. It's coming from beyond the core." then, smaller, "To be continued." One tap closes it. It is shown once and replayable from the Story button.

## F. Art

- Dr Sam Ito, Pack 12 (`mission-control.png` and `mission-control-wow.png`, the second for 3 stars and the signal). Wire whatever is in `docs/art/final/gravity-golf/` as webp in `games/gravity-golf/assets/`; until then draw a headset-and-screen glyph.

## G. Saves

- `saveVersion` 11 adds `openSeen`, `sectorsSeen` (highest sector whose log has shown), `log` (an array of collected fact keys, in order) and `signalSeen`.
- `migrate`: any save with a cleared hole marks `openSeen`; `sectorsSeen` from the highest cleared hole; `log` is filled at once with the facts a veteran has already earned (bodies on cleared holes, sectors reached, ranks held), shown together as one "Probe Log updated" line on the next end card, never a cascade; `signalSeen` is true if hole 30 is cleared.

## H. Out of scope

Aliens, new holes, new badges, any physics, voice acting, and the alien mode (the next chapter).

## I. Acceptance

- The reviewer checks every fact against a general reference and every line against principle 11's counts.
- Every story element skips in one tap and never delays a shot.
- A v10 save at 90 stars plus 5 Expert migrates with no cold open, a filled log and one catch-up line.
- The signal shows once on the first hole 30 clear.
- The Probe Log page fits at 390x844 with 27 entries (scroll if needed, 44 px targets).
- `npm run smoke` passes; the play frame is not slower than v0.10.
