# PRD v0.1: Checkpoint

| | |
| --- | --- |
| Slug | `checkpoint` |
| Version | 0.1 |
| Pattern | P10 |
| Date | 2026-09-30 |
| Status | locked |

This document is the one-shot contract. If something is not in here, the builder should not invent it.

## 1. Pitch

An airport X-ray belt: tap the contraband in each bag before it leaves the screen, and never stop an innocent bag. The fantasy: the officer who never misses.

## 2. The first ten seconds

A dark X-ray screen in portrait. A bag slides down from the top on a belt, contents drawn as glowing outlines in two X-ray tints (organic amber, metal blue). The first bag holds a shirt, a phone, headphones and scissors. Tapping the scissors: a red ring snaps round them, a clack, "+100", the bag slides off sideways into a tray. The second bag is clean: left alone, it exits the bottom with a soft chime and "+20". The third hides a gun shape under a laptop outline.

## 3. Core loop and session shape

- Loop: a bag enters, the player scans, taps contraband (or leaves a clean bag), the bag exits; repeat at the belt's pace.
- A shift is 20 bags or ends at three strikes. About 60 to 120 seconds.
- Closing the app mid-shift discards the shift.

## 4. Controls

Portrait, one thumb.

| Gesture | Where | Does |
| --- | --- | --- |
| Tap | on an item in a bag | flags it: contraband is caught; a harmless item is a false alarm |
| Tap | empty belt | nothing (no penalty) |

Keyboard fallback: none needed beyond mouse clicks.

Occlusion: bags move top to bottom and the hit target is the item's own outline plus a margin, so the thumb covers only the item being tapped; the next bag enters above the thumb.

## 5. Skill model

- **Skill axis:** recognising contraband shapes quickly in clutter.
- **Intermediate tips:** scan for silhouettes; read the dense corner first.
- **Expert tips:** catch early (the score for a catch falls as the bag descends); leave clean bags alone; overlapping items can hide a small blade under a large object, and the outline still shows through.
- **Legendary:** catching two items in one bag before it is a third of the way down.
- **Naked run:** every shift is clearable with no strikes by a player who knows the ten contraband shapes; no item is ever fully hidden (the outline of every item is always at least 60 percent visible).
- **Outsized reward for skill:** catch points scale with how early the catch is (up to x2 in the top third), and a streak of correct bags (catch or clean pass) builds a multiplier x1 to x4.

## 6. Randomness policy

- Random in setup: bag contents, item positions, rotations and overlaps from a seed per shift (seed shown on the card), under packing rules (section 9).
- Deterministic in resolution: a tap on an item's hit shape always resolves that item; hit shapes are the item's polygon plus `hitMargin`, and where two overlap the contraband item wins (never punish a correct tap because a shirt was on top).
- Seed: per shift; a daily seed is deferred.

## 7. Goal, fail, score

- A contraband item that leaves the screen uncaught is a strike (red flash at the bottom, a buzz). A false alarm costs a strike too. Three strikes end the shift.
- Catch: 100 x early factor (2 at the top of the screen, falling linearly to 1 at the bottom) x streak multiplier. Clean pass: 20 x streak multiplier.
- Streak: +1 per correct bag; resets on a strike; multiplier x1, x2 at 5, x3 at 10, x4 at 15.
- Shift clear: 20 bags with fewer than three strikes. Stars: 1 for clearing, 2 for one strike or fewer, 3 for no strikes.
- End card: score, best, stars, strikes, and one tap to the next shift or retry.

## 8. Progression in v0.1

Ten shifts, each unlocked by clearing the previous. Best score and stars per shift. Deferred: badges, a daily belt, new item sets, skins, endless mode.

## 9. Content plan

- Item table as data: name, outline polygon (design units), tint (organic or metal), size, contraband or not, and a "confusable" link (a harmless item that looks like a contraband one: hairdryer and gun, pen and knife, perfume and oversized liquid).
- v0.1 items: 10 contraband (knife, scissors, gun, lighter, large liquid, batteries loose, fireworks, taser, hammer, box cutter) and 20 harmless (shirt, shoes, phone, laptop, headphones, book, toothbrush, charger, small liquid, sunglasses, hairdryer, pen, umbrella, camera, wallet, keys, toy, water bottle empty, belt, snacks).
- Packing rules per bag: 4 to 9 items by shift; at most one contraband in shifts 1 to 3, up to two later; 40 to 55 percent of bags clean; every item at least 60 percent visible; confusables appear from shift 4.
- Shifts 1 to 3 teach, in order: one obvious item on a sparse bag; clean bags exist and must be left; items can overlap.
- Belt speed rises by shift (section 16); shift 5 and 10 are "rush hour" (faster belt, denser bags).

## 10. Juice list

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Catch | red ring snaps round the item, "+N", bag slides into a tray | clack (`hit`) | 10 ms |
| Clean pass | soft green edge on the bag as it exits, "+20" | soft chime | none |
| False alarm | yellow ring, bag flashes, "False alarm" | buzzer (`miss`) | 30 ms |
| Missed contraband | red flash on the bottom edge, the item outline pulses as it leaves | low buzz | 40 ms |
| Streak step | multiplier badge grows | rising tone | none |
| Shift clear | stamp "CLEARED" | `win` | 20 ms |
| Shift over | stamp "SHIFT OVER" | `lose` | none |

## 11. Art direction

X-ray blue-black background, a belt with rollers at the edges. Items as glowing outlines with a soft fill: organic amber, metal blue, overlap areas brighter. Catch ring red (danger), false alarm yellow, clean green. Items must read at arm's length at the belt speed of shift 10. Style sentence: "glowing X-ray outlines on deep blue, clean vector shapes, soft bloom".

## 12. Audio

Engine synth sounds per the juice list; a quiet belt hum whose pitch rises with the streak.

## 13. Modes

One mode (ten shifts). Later: endless, daily belt, "spot the difference" bonus bags.

## 14. Scope fence

Not in v0.1: badges, skins, daily, endless, drag gestures (open bag, rotate), people, a story, bag contents beyond the item table.

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode; portrait
- [ ] A first-time player catches the first item within ten seconds without reading
- [ ] Card to next shift in one tap
- [ ] Every item in every generated bag is at least 60 percent visible (harness over 1000 seeded bags)
- [ ] A bot that taps each contraband item's centre when it is in the top half clears all ten shifts with three stars (harness)
- [ ] A tap on overlapping items resolves to the contraband item
- [ ] Catch, clean pass, false alarm and miss are distinguishable with sound off
- [ ] No text under 14 px; items at least 44 px across at the smallest phone
- [ ] `npm run smoke` passes

## 16. Tuning table

| Name | Value | Meaning |
| --- | --- | --- |
| bagsPerShift | 20 | |
| strikesMax | 3 | |
| beltSpeed | 70, 80, 90, 100, 120, 110, 120, 130, 140, 160 | units/s per shift |
| itemsPerBag | 4-5, 4-6, 5-6, 5-7, 6-8, 6-7, 6-8, 7-8, 7-9, 8-9 | by shift |
| cleanShare | 0.5 | share of clean bags |
| hitMargin | 8 | design units around an item's outline |
| minVisible | 0.6 | minimum visible share of each item |
| catchBase | 100 | |
| cleanBase | 20 | |
| earlyMax | 2 | catch multiplier at the top of the screen |
| streakSteps | 5, 10, 15 | x2, x3, x4 |
| bagGap | 40 | design units between bags |

## 17. Open questions

- Should a bag pause for a beat when fully on screen? Simplest: no; the belt never stops.
- Does a false alarm remove the bag? Simplest: no; the bag continues and its contraband can still be caught.

## Amendments after the layer 1 review (2026-09-30)

1. The miss cue comes after the strike, never before: no pre-miss pulse on an uncaught contraband item (it handed a non-reading player every answer). A strike fires when the item's outline leaves the bottom edge; at that moment a ghost outline of the missed item pulses at the bottom edge for 1 s with "Missed".
2. Reward for skill: catch points use an early factor from 3 (entering at the top) to 0.5 (at the bottom); streak steps x2 at 4, x3 at 8, x4 at 12, x5 at 16. Target: a fast clean shift scores about three times a late one-strike shift on the same seed.
3. Tap targets: `hitMargin` 12, and every item's thinnest dimension at least 16 design units (thicken thin outlines); PRD 15's 44 px means the hit shape's thin dimension at 360x640, and the harness checks it.
4. Visibility means outline: at least 60 percent of every item's outline perimeter lies outside every other item's polygon; the harness checks both area and outline.
5. Confusables add phone and lighter, belt and hammer; keys drawn with a hollow ring so they do not read as a small revolver.
6. The first bag is fully visible at t=0; a clean pass shows its green edge while the bag is still on screen (when its bottom edge reaches the belt's end); the bottom cues sit above `E.safe.bottom`.
7. Shift length target is 40 to 120 s; the belt speeds stay as tuned.
8. The builder's additions (`newContraband` unlock order, `rotMax`, the opener) are adopted into section 16.

## Adopted after layer 2 (2026-09-30)

Section 16 now also holds, as built: `bagH` 260 and `bagGap` 64 (so shift 10 lasts about 40 s), `earlyMin` 0.5, `hitMargin` 12, streak steps at 4, 8, 12, 16 (x2 to x5), per-shift columns `newContraband`, `rotMax`, `maxContraband`, `twoShare`, `overlapBias`, `confusableShare`, and the shift 1 opener. Look-alike pairs: gun and hairdryer, knife and pen, box cutter and toothbrush, taser and charger, large and small liquid, large liquid and water bottle, phone and lighter, belt and hammer.

## Amendments after the v2 review (2026-09-30)

1. Save: `saveVersion` 2; migrate derives `unlocked` from the highest shift with stars (plus one); `unlocked` clamped to an integer in 1 to 10 on read.
2. Difficulty is a slope, not a cliff: belt speed stops being the main lever. Target with the reviewer's human models: an average reader clears every shift at least 60 percent of the time and three-stars shift 10 at least 20 percent; a novice clears shifts 1 to 6 at least 60 percent. Difficulty past shift 6 comes from clutter, look-alikes and overlap, not throughput; shift 10's belt drops so the average reader's queue never saturates.
3. Rush hour is its own beat: on shifts 5 and 10, bags arrive in bursts (three close together, then a gap) at the normal average rate, with a "RUSH" banner and belt hum; target: a good reader's three-star rate on a rush shift is 10 to 20 points below its neighbours.
4. Tangles: a contraband item's overlap partners are biased toward the other tint, so metal-on-metal knots are rare.
5. Look-alike pairs share a tint (the toothbrush and belt become metal-tinted items, or their partners change).
6. Retry reuses the shift's seed; Next and a fresh start use a new one.

## Adopted after v3 (2026-09-30)

Belt speeds are now 70, 75, 80, 85, 90, 90, 95, 100, 105, 95 by shift (difficulty moved into clutter and look-alikes); rush shifts 5 and 10 deliver bags in bursts of three at the same average pitch. Toothbrush and belt are metal-tinted so every look-alike pair shares a tint. The engine has no sustained oscillator, so the belt hum is built from overlapping short tones (a candidate engine ADR later).
