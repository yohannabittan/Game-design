# Gravity Golf PRD v0.11: Lumen and Sam

Status: locked 2026-10-07. Rewritten after the Launch lesson (designer: "it is time to have a bit of story telling, narrative and arc; it doesn't need to be complex but it does need to be a meaningful development"); the arc "Lumen and Sam" (loneliness to connection) approved with "Yes go for the GG backlog". Builds on v0.12. Sections A, B, D and E below are replaced by A2 to E2; C (the Probe Log facts) stands. Cast: `docs/games/gravity-golf/world.md`. Drive: curiosity and discovery. Rules, physics, holes, badges and stars do not change.

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
| comet | "A comet's tail points away from the Sun, pushed by sunlight and solar wind." |
| Nebula sector | "Many nebulae are clouds of gas and dust where stars are born." |
| Meteor shower sector | "A meteor shower is Earth crossing a comet's dust trail." |
| Deep space sector | "Light from far galaxies left them millions to billions of years ago." |
| Binary sunrise sector | "Real planets circle two suns; Kepler-16b was found in 2011." |
| Galactic Core sector | "Our galaxy's centre holds a black hole of four million Suns." |
| Moon rank | "Ganymede, a moon of Jupiter, is wider than Mercury." |
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

## The arc (replaces A, B, D and E)

Loneliness to connection. Dr Sam Ito builds Lumen and talks to it like a friend; every sector says "no life" and Sam grows quieter; the mission is about to be cut; at the core, the signal is another probe like Lumen, sent by someone else who was looking too.

### A2. The cold open: three animated scenes

The same scene style as Launch v0.6 A2: about 3 to 4 s each, from the portraits plus simple drawn props, squash-and-stretch tweens, the text fading in under; a tap jumps to the scene's end, the next tap advances, auto-advance a second after, Skip always visible and ending it all; replayable from a Story button on the menu.
1. **The lab.** A night lab, screens glowing; Sam (`mission-control`) leans over a bench where Lumen (the ball, drawn larger) sits; Sam taps it and it blinks awake. "Dr Sam Ito built a little probe to answer one question."
2. **The question.** Sam looks up at a window full of stars; one star twinkles. "'Are we alone, Lumen? Let's go and see.'"
3. **The launch.** A rocket streaks up from a small Earth, a tiny light separates and curves past the Moon (the first gravity assist). "Ride the gravity. Send home everything you find."

### B2. Sam's voice grows with the journey

- Sam's portrait and one line on every end card, as before (cosmetic, `Math.random`), but the pool **changes by sector**, so the mood carries the arc:
  - **Starfield (holes 1 to 5), excited:** 3 stars "Clean assist! Data received!"; 2 "Got there. Every bit counts."; 1 or less "Scenic route. I'll allow it."
  - **Nebula (6 to 10), hopeful:** "Gas, dust... maybe something?", "Beautiful data, Lumen.", "Keep looking. I've got a feeling."
  - **Meteor shower (11 to 15), joking:** "Rocks. Again. Very nice rocks.", "Mind the ice, little one.", "I named one of those rocks after you."
  - **Deep space (16 to 20), quiet:** "No life. Still beautiful, though.", "It's very quiet out there, isn't it?", "When I was a kid, I waved at the sky every night." (the midpoint line: shown once, the first time hole 18 is finished, then in the pool)
  - **Binary sunrise (21 to 25), stubborn:** "Two suns. Still nobody home.", "They keep asking what we've found.", "I'm not giving up on you."
  - **Galactic Core (26 to 30), last chance:** "This is it, Lumen.", "Make every shot count.", "Whatever's there, we find it together."
  - **An Expert fourth star (any sector):** "No guide lines? Show-off."
- The sector arrival log lines and the facts (C) stay as they were.

### C2. The turn

- The first time hole 26 opens (entering the Galactic Core), an animated card before its first shot: Sam on a dim video call (`mission-control`, drawn with a worried brow and a dimmer screen; Pack 14 `mission-control-worried` when it lands): "They're cutting the mission, Lumen. The core is our last sector." Then, smaller: "So let's make it count." One tap per beat, Skip visible.

### D2. Ranks keep their facts

- Unchanged from D: the rank-up card shows the rank's fact.

### E2. The ending: we are not alone

- The first time hole 30 (Sagittarius) is cleared, an animated sequence before the end card:
  1. A slow pulsing waveform on Sam's screen. "A signal. Not natural."
  2. Out of the core's glow drifts **another probe**: small, a different shape (drawn: a hexagon with three thin antennae and a soft violet light), carrying a little disc like Lumen's. It blinks a short pattern of lights.
  3. Lumen blinks back. Sam (`mission-control-wow`): "We're not alone." Then: "And they were looking for us too."
  4. Sam, softly, waving at the screen: "Hi." The other probe's light flickers like a wave. "To be continued."
- Replayable from Story. After it, Sam's pool everywhere gains a happy line: "Still can't believe it. Hi, friend."

### F2. Art

- Existing finals: `mission-control.png`, `mission-control-wow.png` (Pack 12). New, small: Pack 14 `mission-control-worried.png` for C2 (fallback: the normal portrait with a drawn brow and a dimmed screen). The other probe is drawn by the game.

### G2. Saves

- As G, plus `turnSeen` and `endSeen` (replacing `signalSeen`), and `midSeen` for the hole 18 line. `migrate`: a save past hole 26 marks `turnSeen`; a save with hole 30 cleared does **not** mark `endSeen`, so the designer sees the new ending once after their next finished hole (a single catch-up card, as Launch's proposal).

## F. Art (superseded by F2)

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
