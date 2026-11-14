# First minute: Gravity Golf, Ink, Recoil (2026-11-14)

Helper look, about 45 minutes. Friends' release copy (`open(slug, { release: true })`), fresh save, no sound heard. Gravity Golf and Ink at 390x844 portrait, Recoil at 844x390 landscape. I tapped and dragged with a script as someone who had read nothing. I can report what the screen does, not whether it is fun.
Everything below is in `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/firstmin/` (shortened to `firstmin/`).

All three open on a cold-open story (a fresh save). Each card swallows a first tap (it jumps to the card's end), so an early tapper needs about two taps per card. Skip (top right) is one tap. Every menu shows an EXPORT button top left in the friends' copy; I did not check whether friends are meant to see it.

## Gravity Golf
Files: `firstmin/golf-first-minute.gif` (first tap to hole 2, 24 s), `firstmin/gg1-m.png` (the three story cards and the menu), `firstmin/gg-hold2.png` (aim preview, then release), `firstmin/gg4-m.png` (hole 1 and its result card), `firstmin/gg5-h2.png`, `firstmin/gg5-m3.png` (hole 2).
- **To real play:** 3 story taps + Play = 4 taps, 5.7 s. First drag is the 5th touch, about 7 s in. Skip would make it 2 taps.
- **Verbs:** drag-and-release to shoot (told in text on hole 1 only; the dotted preview shows the flight, which also teaches it). Gravity pulls and wall bounces (found by doing). "Tee +1" resets the ball for a stroke (told by its label). A newcomer would never use: Missions, Story replay, the hole select (the Play button already goes to hole 1).
- **Text:** story 11 + 8 + 8 words, longest 11 ("Dr Sam Ito built a little probe to answer one question."). Hole 1 hint 11 words ("Drag anywhere away from the ball to aim, release to shoot."), over the 8-word rule. Menu about 15 words. Result card about 35 words, longest 10 (the Voyager 2 fact). Hole 2 has no hint.
- **Answers:** a sink glows the cup green and then a card, with a badge pop-up on the first ("Touchdown") and a log line. The result card states both targets in small type ("3 stars: 1 shot, 2 stars: 2 shots"). A bad shot has no word. In hole 2 two wasted shots showed a bounce and a growing "Run: 4 strokes" line and nothing else. With sound off, a good and a bad shot differ only by the cup glow and the card. Sun and black-hole penalties: not verified.
- **After finish:** Next is 1 tap; Retry and Menu beside it. Reason to go again: stars out of three, the target in small type, "Best 2". There is no loss in this game.
- **Odd:** my first scripted drag (finger up, toward the hole) sent the ball down the screen into the wall, though the preview in the later hold test pointed up at the hole and the ball followed it. It then bounced round and sank in 2 shots (par). I could not tell whether my script or the game caused it. Not verified; worth one feel by the designer.
- **Cheapest changes:**
  1. **Best: put the story after hole 1 on a fresh save.** Four taps and 6 s of text before the first drag, and the story teaches nothing about the drag. The finish card already gives the player a fact line and Sam; the cold open can play from the menu's Story button or after hole 1. Evidence: `gg1-m.png`.
  2. **Cut the hole 1 hint to 8 words that say which way the ball goes** ("Drag back. Release. Dots show the shot."). It is 11 now and does not say where the ball will fly. Evidence: `gg-hold2.png`.
  3. **Make "3 stars: 1 shot" the headline of a 1 or 2 star card** and Retry the green button for holes 1 to 5, with Next second. Today the target is the smallest text on the card and Next is the loud one. The designer's own v25 export shows hole 1 took 9 tries, so the pull is there on a hard hole; the card could use it on the easy ones.

## Ink
Files: `firstmin/ink-first-minute.gif` (3 story/menu taps to a ruined first try, 22 s, about 4 frames a second so it is choppy), `firstmin/ink1-m.png` (cold open and menu), `firstmin/ink3-m.png` (menu, first touch, slips, result), `firstmin/ink5-m.png` (a careful fill at 67%), `firstmin/ink6-m.png` (time out at 68%).
- **To real play:** 2 story taps + Play = 3 taps, 3.9 s, then the piece is on screen. First ink on the 4th touch, about 4 s in. Quickest of the three.
- **Verbs:** touch and move lays ink with the needle about 65 px ahead of the finger (found by doing; no text at all, and the needle only appears after the first touch). Lifting the finger is free and matters at corners and for parts (never taught; my scripted play never lifted on purpose). Hint toggle, Story, Missions, Daily: a newcomer never needs them in the first minute.
- **Text:** story 5 + 7 words. Client plate "Something simple. My first." (5 words, gone at first touch). Menu about 12 words. Result card about 15 words, longest 7. Nothing says "stay inside the line", or that three crossings ruin the piece; the three small circles top right are the only sign.
- **Answers:** a good fill: smooth black ink, the percentage climbs, no other answer until the end. Slip: a red X on the line and one of the three circles turns to a red X. Bad play ends at once with a sad client and "Ruined: three slips". My first scribble was ruined in about 3 s at 15% with two slips at the ends of the first strokes, before I knew where the needle was.
- **Hard to tell apart:** a time-out at 68% (no slips) shows the same sad client, the same "Oh. Well. It's done now." and no reason line, with five empty stars and no target. The player cannot tell time from slips. I did not reach a good finish; not verified.
- **After the loss:** Again is 1 tap (the card is up by about 2 s). Reason to go again: only the sad client and "Best 68%". No star target.
- **Cheapest changes:**
  1. **Best: show the needle before the first touch, with a ghost drag** on piece 1 (eight words at most: "Drag to ink. The needle leads. Stay inside."). Evidence: `ink3-m.png`, ruined in 3 s with nothing to say where the needle sits or what a slip is.
  2. **Say why a try ended and what it needed:** "Time ran out at 68%. 85% for a star." instead of the same line for both endings. Evidence: `ink6-m.png` (no reason) against `ink3-m.png` ("Ruined: three slips").
  3. **Make slips louder the first time:** a short word ("OUT") beside the red X on the first slip of a fresh save, and the three circles pulse once. Cheap and local. Evidence: the slips in `ink3-m.png` are two small red crosses.

## Recoil
Files: `firstmin/recoil-first-minute.gif` (first tap to the result card, 25 s), `firstmin/rc1-s4.png` (menu), `firstmin/rc2-m.png`, `firstmin/rc2-frames-full/0176.png` (a miss), `firstmin/rc3-e1.png` (result), `firstmin/rc4-m.png` (left taps).
- **To real play:** 3 story taps + Play Accuracy 1 = 4 taps, 5.7 s. A newcomer meets the menu's dense grid (five ladders, locked tiles, Prop Room, Extra, Endless) between the story and Play, with Play at bottom right.
- **Verbs:** fire (told: "Right thumb fires"); drag the gun (told in the same line, never needed in my first shot: the gun was already lined up with the target, so the first shot scored 50 with no drag); cancel the kick by nudging as you fire (the concept's core move, not taught or shown); Reload (never used: 12 rounds ended the run first); gun change, Prop Room, Endless, Missions (never met).
- **Left taps do nothing, and say nothing:** two taps on the left half left rounds at 12/12 (`rc4-m.png`).
- **Text:** story 10 + 10 + 7 words, longest 10. Hint 8 words, held 3 s then faded ("Left thumb drags the gun. Right thumb fires."). Menu about 40 words (ladder names, tile text, "Accuracy 2: two stars on Accuracy 1", "10 stars to Intern"). Result about 25 words.
- **Answers:** a hit: the score rises (50) and the target flashes. A miss: the barrel kicks up, a thin tracer crosses the backdrop, nothing else. No word, no number change. With sound off a miss and a hit differ only by the score ticking up. My 14 fast taps made 2 of 8 hits (150 points). Why they missed (recoil, or the moving target) is not said.
- **After the run:** Again is 1 tap. The card gives "150, New best!", "690 to ★", "2 of 8 hits, 1 bullseye, +$3" and a director line ("Cut! We can't afford many more takes."), the best pull of the three: a number to beat and a gap to the star.
- **Cheapest changes:**
  1. **Best: a one-word reason on a miss** ("HIGH", "LOW", "EARLY") where the shot landed. Principle 18 asks for it; the barrel kick is the whole skill and a miss doesn't say it was the kick. Evidence: `rc2-frames-full/0176.png`, `rc3-e1.png` (2 of 8, no reason).
  2. **Start rung 1 with the target off the gun line and keep the hint until the first drag.** Evidence: the first shot scored 50 with no drag, so the second verb is never learned; the hint is gone after 3 s.
  3. **Add one tip to the result card from the run** ("5 shots went high: nudge down as you fire"), in place of the director line on a first card. Evidence: `rc3-e1.png`.

## What I could not judge
Whether any of this is fun. The hit, finish and sound feel; difficulty beyond the first piece or rung; a clean win in Ink; Recoil with a real thumb on the left; Golf's sun and black-hole penalties; anything beyond hole 2 of Golf. Scripted touch is not a thumb.
