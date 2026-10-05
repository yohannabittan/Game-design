# Checkpoint PRD v0.3: get the flight home safe

Status: locked 2026-10-05 from the story plan the designer approved (`docs/story-plan.md`, Checkpoint; "the flight didn't take off"). Builds on v0.2 with K-lean. Cast: `docs/games/checkpoint/world.md`. Drive: protection. Rules, scoring, items, timings and ranks do not change. **Build after Pack 10 lands, or with the fallbacks.**

## A. The cold open (first launch only)

- Two cards, one tap each, "Skip" always visible (44 px), replayable from a "Story" button on the menu:
  1. "Airport security. Today's flight leaves at dawn."
  2. "Your job: nothing dangerous gets on board."

## B. Each day is a flight

- The briefing card names the flight and Supervisor Pat Okoye gives the tip, with her portrait (Pack 10 `supervisor.png`; a lanyard-badge glyph fallback). The existing `tips` become her lines; empty ones are filled:

| Day | Flight | Passengers | Pat's line |
| --- | --- | --- | --- |
| 1 | Flight 1 to the coast | 96 | "First day. Breathe. Look at every bag." |
| 2 | Flight 2 to the lakes | 112 | "Metal is blue. Blue near a person, look twice." |
| 3 | Flight 3 to the mountains | 128 | "Don't stop clean bags. They have a plane to catch." |
| 4 | Flight 4 to the capital | 182 | "Fireworks season. Watch the tubes." |
| 5 | Flight 5 to the islands | 204 | "Rush hour. Steady hands beat fast ones." |
| 6 | Flight 6 to the north | 140 | "Vic's back. He's learned a new trick." |
| 7 | Flight 7 to the desert | 156 | "Dense things show black. Black hides things." |
| 8 | Flight 8 to the valley | 168 | "One glance per scan." |
| 9 | Flight 9 to the old town | 190 | "Pull the lever only when it is easy." |
| 10 | Flight 10, the holiday rush | 240 | "Holiday rush. Everyone wants to be home." |

## C. The end card is the plane

- A strip at the top of the existing newspaper end card shows the plane (Pack 10 `plane.png`; a simple silhouette fallback):
  - **a cleared day:** the plane lifts off and "Flight 4 landed. 182 passengers home safe."
  - **a breach:** the plane stays on the stand and **"The flight didn't take off."** Smaller: "Passengers are waiting while it's searched."
- Pat's portrait and one line under it, cosmetic: 3 stars "Nobody's flying safer today.", 2 "Good shift. Tidy up those strikes.", 1 "They got home. Let's be sharper.", breach "We'll get them off tomorrow."
- The newspaper headline stays.

## D. Travellers speak

- When a traveller is stopped, a short bubble beside them for about 1.5 s, from a pool by character: Vic "Just holiday things!", "Never seen it before!"; Grandma Rose "They're only needles, dear."; Mr Abernathy "It's a gift for my nan!", "It's a snow globe!"; others "I'm late!", "Is this about my shoes?" A cleared traveller sometimes says "Thanks!" or "Have a good day!". Cosmetic, never covers the belt or a tap target.

## E. The departures board (payoff)

- After day 10 ends, and from a "Departures" button on the menu once day 10 has been played: a board of the 10 flights, each LANDED (green, the day was ever cleared), GROUNDED (red, played but never cleared) or blank (not flown). Derived from the existing `shifts` save; nothing new is stored for it.

## F. Saves

- `saveVersion` 5 adds `openSeen`. `migrate` marks it true for any save with a played shift.

## G. Out of scope

New items, rules, ranks or days; voice; changes to the X-ray, the lever, scoring or the detector.

## H. Acceptance

- Text counts per principle 11 on the briefing, end and board cards.
- Every story element skips in one tap and never delays a shift.
- A v4 save migrates with no cold open; the board reads its days right.
- Fallbacks draw while art is missing.
- `npm run smoke` passes; frame time is not worse than checkpoint-v11.
