# Checkpoint PRD v0.4: Pat's Last Week

Status: **draft**, for the designer (2026-10-12).

**Where it comes from:** the arc pitched with Lumen and Sam, Backlot 88 and Rita's Swallow (protection, and passing the torch). It is rewritten in the Launch v0.6 style, because v0.3 was the plain card style that Launch outgrew ("too simplistic to be fun").

**What it builds on:** v0.3 was locked but never built. v0.4 keeps v0.3's machinery:
- a flight per day;
- the plane on the end card;
- the travellers' bubbles;
- the departures board;
- the fallbacks.

v0.4 replaces what it says, and adds three animated moments.

**What doesn't change:** rules, items, timings, scoring and ranks. The art has landed: `supervisor.png`, `supervisor-proud.png` and `plane.png` (Pack 10).

## The arc

Supervisor Pat Okoye has run this lane for thirty years. She retires after the holiday rush and is training you to take her place. Vic the smuggler gets bolder every day.
- **The turn:** Flight 10 is Pat's own flight home to her grandkids, and you're guarding it.
- **The ending:** you catch Vic's cleverest bag, her plane takes off, and over the radio comes "Lane's yours, Officer."

## A. The cold open: three animated scenes

Played on the first launch, with Skip always visible, and replayable from Story. The scene style follows Launch A2: about 3 to 4 s each, portraits plus simple drawn props, squash-and-stretch tweens, and the text fading in underneath.

1. **The lane at dawn.** A plane on the stand through the window. Pat (`supervisor`) taps her clipboard. "Supervisor Pat Okoye has run this lane for thirty years."
2. **The lanyard.** Pat holds out a lanyard, and it swings to you. "'Ten days till I retire. Then this lane is yours.'"
3. **Vic.** At the back of the queue, a whistling figure with a lumpy suitcase winks. "'And watch out for Vic. He never gives up.'"

## B. Pat's briefing lines (replace v0.3 B's lines; flights and passengers unchanged)

| Day | Pat's line |
| --- | --- |
| 1 | "First day. Breathe. Look at every bag." |
| 2 | "Metal is blue. Blue near a person, look twice." |
| 3 | "Don't stop clean bags. They have a plane to catch." |
| 4 | "Fireworks season. Watch the tubes." |
| 5 | "Rush hour. Steady hands beat fast ones." |
| 6 | "Vic's back. He's learned a new trick." |
| 7 | "Dense things show black. Black hides things." |
| 8 | **The turn** (C) |
| 9 | "Tomorrow I'm a passenger. You've got this." |
| 10 | "Holiday rush. Everyone wants to be home. Me too." |

## C. The turn (the day 8 briefing, animated, once)

1. Pat (`supervisor`) sits on the edge of the desk and shows you a photo: two small drawn kids waving. "'Flight 10 is my flight home. They're waiting at the other end.'"
2. Smaller, as she stands: "'So get it off safe.'"

One tap per beat, with Skip visible. Replayable from Story once seen.

## D. Vic's thread

His bubble lines (v0.3 D) escalate by day:

| Days | Vic, stopped |
| --- | --- |
| 1 to 3 | "Just holiday things!", "Never seen it before!" |
| 4 to 6 | "New trick, Officer!", "You're good. I'm better." |
| 7 to 9 | "Pat taught you that, didn't she?" |
| 10 | "This one's my masterpiece." Caught: "Next year, Officer!" |

- **Day 10's Vic bag** is a fixed bag in that day's data: the game's hardest existing look-alike, from existing items only. Pat's day 10 line hints at it, and catching it is the ending's beat.
- Grandma Rose and Mr Abernathy keep their v0.3 lines.

## E. The ending (day 10 cleared, the first time; animated, before the board)

1. Pat walks through your scanner with a carry-on and gives you a thumbs up (`supervisor-proud`). "'Not bad, Officer. Not bad at all.'"
2. The plane (`plane`) lifts off, and a tiny figure waves from a window. "Flight 10 landed. 240 passengers home safe."
3. A radio crackles on the desk. "'Lane's yours, Officer.'" Then the departures board, as v0.3 E.

**If day 10 is a breach:** the plane stays on the stand, and the line is "Pat's flight didn't take off. The kids will wait a little longer." Smaller: "Try again. She believes in you." It is shown each time until the day is cleared.

## F. The end card (v0.3 C, with new lines)

The plane strip and Pat's portrait stay. Her lines grow warmer through the week:
- **days 1 to 5:**
  - 3 stars: "Nobody's flying safer today.";
  - 2 stars: "Good shift. Tidy up those strikes.";
  - 1 star: "They got home. Let's be sharper.";
- **days 6 to 9:**
  - 3 stars: "You'd have caught me at your age.";
  - 2 stars: "Almost ready.";
  - 1 star: "Not your best. Sleep, then sharper.";
- **a breach, any day:** "We'll get them off tomorrow."

## G. Saves

`saveVersion` 5 adds:
- `openSeen` (as v0.3);
- `turnSeen`;
- `endSeen`.

`migrate`:
- a played save marks `openSeen`;
- a save past day 8 marks `turnSeen`;
- a cleared day 10 does **not** mark `endSeen`, so a veteran sees the ending once, after their next cleared day 10 (as Launch's proposal did).

## H. Out of scope

- new items, rules, ranks or days;
- voice;
- new art (the kids' photo and the waving figure are drawn by the game).

## I. Acceptance

- Text counts per principle 11.
- Every story element skips in one tap and never delays a shift.
- Day 10's Vic bag is in data and is catchable by its tell.
- A v4 save migrates as in G.
- The fallbacks draw while art is missing.
- `npm run smoke` passes.
- Frame time is no worse than checkpoint-v11.

**Rough cost:** one Sonnet build, about $8 to $10 and about an hour.
