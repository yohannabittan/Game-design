# Arena step: blows that say what they did, and knives that hurt (locked 2026-11-14)

**The designer,** across three runs today:
- "I think I played sica and could not get a bite. Does that mean it can only be played in one direction? Hit a bear tons of times but no damage on bear skin."
- "I also think knives should hurt more."
- To the proposal below (heavier knives; the sica's point stabs; a hit that does nothing looks like nothing; armoured beasts wear less): "Yes sounds good go."

**What was found** (`2026-11-14-sica-bear-finding.md`, still `../sketches/bear-no-bite.png`): the Haemorrhage card makes bare hits do 0 and shows NO BITE while still spraying blood, sounding like a cut and shaking the screen; a barded bear is about 62% plate, and a slash on plate shows sparks and no word; a sica jab is always a haft thud; a knife does 5 in a gap, less than a gladius jab there, and nothing anywhere else.

**The rule for this step: what you see and hear is what happened.**

## What the player gets

**1. Knives hurt.**
- In a gap: 12 (was 5). On bare skin: 4, with a mark (was nothing). On plate: nothing, as now.
- A knife on bare skin follows the same card rules as any hit on bare skin.

**2. The sica's point stabs.**
- A push toward him with the sica is a stab with its point: on bare skin a small wound, in a gap a gap hit, at about three quarters of what a gladius's jab does in each place.
- Only a contact with the grip or the back of the hand is still a thud.
- Its slashes and its hook are unchanged.

**3. A blow that does nothing looks and sounds like nothing, and says why.**
- If a blow takes no health, adds no bleed and dents nothing: no blood, no cutting sound, no screen shake. A dull sound, and one short word for the reason.
- If a blow takes no health but does something else (starts a bleed, dents a plate), it shows that thing and names it.
- A slash on plate gets a word, as a jab on plate already does.
- The words are few and each means one thing. Reuse the ones the game has (NO BITE, GLANCES OFF, THUD) before adding any.

**4. Armoured beasts wear less.**
- A barded lion or bear wears plate on the head and chest only. The belly, back and legs are hide.
- Their health and moves do not change.

**Nothing else moves:** men's armour, other weapons' numbers, the Haemorrhage card's rule and text, prices.

## Acceptance

1. A knife thrown into a gap takes 12; onto bare skin 4, with a visible mark; onto plate 0. The run log still counts gap, skin, plate and miss.
2. With the sica at Strength 3, a level push into a man's open gap is a gap hit worth 70% to 80% of a gladius's at the same Strength; onto bare skin, the same share of a gladius's jab on skin. Neither shows THUD.
3. With Haemorrhage, a hit on bare skin shows no more blood, sound or shake than what it really did. A screenshot of it could not be mistaken for a wound.
4. A slash on a plate shows a word every time, and the word differs between a slash that dented the plate and one that did nothing.
5. In Rome's fourth bout, a level slash at belly height from the front meets hide or a gap on a barded bear, and at least 40% of its side-on body is hide or gap. The same for a barded lion.
6. `npm run check arena` passes, with a permanent check for items 1, 2 and 4. Any replay whose hash rightly changes is named in the report for the orchestrator to accept.
7. `RULES.md` is updated for all four parts, and its note that a sica jab is always a thud is removed.

## Open questions, simplest option taken

- **How a knife is thrown** (hold to throw, the aim line, the throwing arm): not in this step. The designer is choosing from a touchable sketch (`../sketches/knife-aim.html`).
- **Whether a knife on bare skin bleeds:** no. It wounds for 4 and that is all.
- **Balance:** heavier knives and barer beasts make Rome and knife builds easier. Not retuned here. The designer's play decides.

## The designer will judge it

By stills or a GIF of: a knife in a gap; a sica stab into a gap; a slash on plate with its word; a barded bear side-on. And by playing.
