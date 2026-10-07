# Recoil PRD v0.9: The Last Picture at Backlot 88

Status: locked 2026-10-07 as step 3 of the Recoil plan ("Go with the recoil plan"), from the arc the designer liked:
- the designer: "it is time to have a bit of storytelling, narrative and arc; it doesn't need to be complex but it does need to be a meaningful development";
- the arc, from the story proposals: "an underdog saves a found family".

It builds on v0.8 and keeps v0.7's machinery: the career ladder, the director's note, the posters, the poster wall and Gus's lines. This version changes what they say, and adds the turn and the ending as animated scenes in the style of Launch v0.6 A2. Cast: `docs/games/recoil/world.md`.

## The arc

Backlot 88 is broke, and this film is its last chance. Gus the prop master spots you among the extras and starts slipping you better props. Halfway up, the star walks off the set, and Big Lou gambles the studio on you. At the premiere the film is a hit, the studio is saved, and your name is on the poster, with Gus in the front row.

## A. The cold open: three animated scenes (replaces v0.7 C)

1. **The lot.** A neon backlot at dusk; a "FOR SALE" sign is half nailed onto the gate. "Backlot 88 is broke. This film is its last chance."
2. **The extras.** A crowd of extras in a line. Big Lou (`director`) shouts through the megaphone, and you are the small figure at the end, fumbling a prop gun. "You're an extra. Your only line so far was a scream."
3. **Gus.** The prop master (`prop-master`) leans out of the Prop Room and winks, sliding a pistol across the counter. "'Kid. Take this one. It shoots straight.'"

## B. Career beats become story beats (replaces the v0.7 B rank cards)

- **Intern (10 stars):** Big Lou: "You! Coffee, then set. Don't trip on the cables." Gus: "Told you it shoots straight."
- **Stunt Double (40 stars), the turn,** as an animated scene:
  - the star's trailer door slams, and a pair of sunglasses is tossed on the floor;
  - Big Lou: "He walked. No star, no film, no studio.";
  - then, looking at you: "...Kid. Can you fall off a roof?"
- **Action Star (100 stars), the ending,** as an animated scene:
  - a premiere marquee with your silhouette on the poster;
  - flashbulbs, and the "FOR SALE" sign pulled down;
  - Big Lou (`director-approve`): "We're saved. You saved us.";
  - Gus in the front row, clapping: "Always said it shoots straight."
- Every beat skips in one tap, as before.

## C. Voices carry the arc

- **Big Lou's note on the result card** changes with your career:
  - **as an Extra:** worried. "Cut! We can't afford many more takes.", "The bank called. Again. Go again."
  - **as an Intern:** gruff hope. "Not bad. Not bad at all.", "Keep that up and we might make payroll."
  - **as a Stunt Double:** all in. "The whole studio's riding on you, kid.", "Print it! The bank can wait."
  - **as an Action Star:** proud. "That's my star.", "They're lining up round the block!"
  
  Within each career pool, the line still follows the take's stars: lower stars get the more worried line.
- **Gus's Prop Room line** gets one new line per career step, said once when you open the Prop Room after the step: "Got you something special. Don't tell Lou."
- **The posters** become the films that save the studio. Each released poster adds "box office +1" to a small studio-funds bar on the poster wall, and the bar fills as the posters do. At 6 of 6 the gate sign reads "NOT FOR SALE".

## D. Saves

- `saveVersion` bump. `openSeen` becomes a story version, so the new open shows once to everyone. `turnSeen` and `endSeen` are added.
- `migrate`:
  - a veteran already at Stunt Double or above sees the turn once, at the next result card;
  - a veteran already at Action Star then sees the ending once;
  - there is never more than one catch-up card at a time.

## E. Art

- Everything here is final art: `director`, `director-approve`, `prop-master`, `prop-master-sold`, the posters, and `title-backlot88`.
- The scenes' props (sign, trailer, sunglasses, marquee, flashbulbs) are drawn by the game.

## F. Out of scope

Rules, guns, prices, bars and rungs.

## G. Acceptance

- Principle 11 counts on every card.
- Every story element skips in one tap and never delays a run.
- The turn and the ending each fire once, including for migrated veterans, with no cascade.
- `npm run smoke` passes. The play frame is not slower than v0.8.
