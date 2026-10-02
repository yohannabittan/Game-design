# Checkpoint PRD v0.2: travellers, real X-ray, stakes and a rush lever

Status: locked 2026-10-01. Builds on v0.1 (shipped, checkpoint-v7, release v1.4). Source: the designer's playtest (`playtests/2026-10-01-v6.md`: "a good concept and it works but it's missing fun, difficulty, umph, storytelling") and decisions in chat: the body scan shows normal and contraband things on the person (belt buckle, earrings, a knife on the lower leg, a gun under the arm, other metal or contraband); real X-ray colours; a missed critical item ends the game; a way to accelerate the belt for extra points when it is too easy.

**Process (from the Launch learnings): feel first.** One build for the dev channel with big TUNE knobs and two presets (**Calm** and **Rush hour**); the designer tunes on the phone; the balance pass after. Only section H gates this build.

## A. The scene: belt left, travellers right (portrait)

- The screen splits: the X-ray belt on the left (about 60 percent of the width) with bags moving top to bottom as now; the walk-through detector lane on the right, travellers queueing at the top and walking down through the arch.
- Each traveller and their bag share a colour tag (on the bag's handle and the traveller's tray ticket); a traveller reaches the arch while their bag is on the belt, so the two are read together.
- Splitting attention between the lane and the belt is the new difficulty: every glance at a person is time not spent on a bag.

## B. Body scan

- As a traveller passes the arch, a body-scan view (a silhouette in the scanner style) shows what they carry on the body for `scanShow` (about 1.4 s), then fades as they walk on; the traveller can still be tapped until they leave the lane.
- Body items, drawn on the silhouette where they are worn:
  - normal: belt buckle, earrings, wristwatch, keys, coins, glasses, rings, zipper, hair clip, phone in a pocket, underwire, a knee brace;
  - contraband: knife strapped to the lower leg, gun under the arm, brass knuckles, a taser on the belt, a lighter in a pocket, a blade in a boot.
- Tapping a flagged body item (or the traveller while it shows) catches it; tapping a normal one is a false alarm.

## C. Stakes: a severity ladder

| Tier | Examples | Catch | Miss |
|---|---|---|---|
| Minor | liquids, lighters, batteries | points | one strike |
| Serious | knife, taser, box cutter, fireworks, brass knuckles | big points | two strikes |
| **Critical** | **gun**, explosives | **SWAT**: sirens, lights, officers drop in and tackle the traveller, a slow-motion beat, a big bonus (larger the earlier the catch) | **instant end of the shift**: a red alarm and a newspaper headline on the card |
| False alarm | tapping anything harmless | n/a | a strike, a time penalty, the traveller grumbles, the streak breaks |

A critical item caught in the bag also triggers the SWAT moment on that bag's traveller.

## D. Real X-ray colours and occlusion

- Colour by material, as airport scanners do: **orange** organic (food, liquids, clothes, paper), **green** plastics and light inorganics, **blue** metal, **black** very dense (laptop batteries, thick metal). Dense objects darken and hide what is beneath them.
- More occlusion: items pack tighter and overlap more, so a blade can sit under a laptop; fairness rule: every contraband item keeps one distinctive part readable (a gun's trigger guard and barrel, a blade's point, a lighter's hood and wheel) even when overlapped.
- More items: about 15 new ones, mostly harmless look-alikes per colour family (hairdryer against gun, pen against box cutter, phone charger against taser, perfume against large liquid, multi-tool, fork, knitting needles (allowed), a toy gun (allowed? simplest: contraband, minor), a snow globe (liquid)).
- Redraw for silhouette: the lighter as a classic disposable with hood and flint wheel; scissors with two finger rings and crossed blades. Every item is checked at phone size for reading at a glance.

## E. Rush lever (accelerate for points)

- A lever beside the belt: pulling it (tap or drag down) runs the belt and the lane at `rushSpeed` (about 1.6x) with a score multiplier `rushMult` (about 1.5x) and a rising hum; pushing it back returns to normal. The game never forces it: every shift is clearable at normal speed, and stars do not need it (score and the best score do reward it).

## F. Story and juice

- Recurring characters: a grandma (knitting needles, allowed), a nervous businessman (always clean), a smuggler who returns each shift with a cleverer hiding place, a tourist with souvenirs. Behaviour (sweating, glancing, sunglasses) is flavour and misdirection, never the tell; only the scans are.
- Bags get a CLEAR or SEARCH stamp; the belt hums and speeds with the streak and the lever; the SWAT moment; the end card as a newspaper front page; each shift a day in a career from rookie to senior officer.

## G. TUNE

At most four sliders on screen: belt speed, traveller pace, scan time, occlusion; presets Calm and Rush hour.

## H. Must-holds (the only gates)

1. Deterministic: the same seed and tap times give the same shift at 30, 60 and 120 fps; setup randomness only.
2. Fair: every contraband item in a bag keeps its distinctive part readable (harness check); every body item shows for at least `scanShow`; no critical item ever appears without a readable tell.
3. A first-timer can clear shift 1 (harness reader profile, as v0.1's average reader, at least 60 percent).
4. Frame time at 4x throttle within 10 percent of v0.1 at 390x844.
5. Saves migrate (stars, best scores and unlocked shifts kept).
6. Text 14 px and targets 44 px (items and travellers stay tappable at 390 px wide; the hit margin may grow); smoke passes.

## I. Out of scope

New modes, a daily seed, upgrades or a shop, generated images, music, re-tuning shifts 2 to 10 beyond what the new layout needs to stay clearable.

## J. Amendment after the v0.2 playtest (2026-10-02): the detector decides whom to check

Designer: "fun but a bit too much; not everyone has metal, and the ones that do give an audio cue as they walk through, like in real life, so I know to check them."

1. **Only metal sets off the arch.** A traveller carrying no metal (on the body) walks through clean: a soft green light, no body scan shown, nothing to check. A traveller carrying metal (a buckle, keys, a watch, a gun, a knife) sets off the arch: a two-tone beep and the arch light flashes amber (the visual twin of the sound, so it works muted, principle 16), and only then the body scan shows for `scanShow`.
2. **Share:** about a third of travellers beep on day 1 (`beepShare`, rising by day); most beepers carry only harmless metal, so a beep means "look", not "guilty". Non-metal contraband on the body (a ceramic blade, a liquid) does not beep and is out of scope for this version: body contraband is always metal.
3. **Queued fixes from the v0.2 quick review:** a breached day never counts as a best and never shows "New best" (bests only on a cleared day, also fixing v0.1's logic); the SWAT bonus is capped so it never exceeds about a third of a good day's score; a missed body critical ends the day when the traveller leaves the arch area, not the lane (seconds sooner); the lighter's silhouette is made unmistakable at phone size (flint wheel and hood clearly drawn, not a small bottle); the RUSH HOUR banner never covers the belt's top band.
4. **Must-holds:** section H, plus: no body scan is ever shown for a traveller who did not beep, and every beep has both the sound and the arch light.

## K. Generated item images with rectangle hitboxes (2026-10-03; build after the art pack lands)

Designer: "the skill is not in hitting a hit box perfectly, so we can use an image and estimate a rectangle hitbox." Source images: `docs/art/final/checkpoint/` (BRIEF.md Pack 3).

1. Belt and body-scan items draw from the generated images, composited so overlaps still darken (multiply) and dense parts still hide what is under them; the procedural shapes stay as the fallback while loading or if an image fails.
2. **Hitbox:** each item's hit area is its image's opaque bounding rectangle, rotated with the item, plus `hitMargin`; where rectangles overlap, contraband still wins (v0.1 rule). No correct tap may ever resolve to the wrong item.
3. **Fairness:** each contraband image declares a tell box (the part that identifies it), in image coordinates in data; the packer keeps every contraband tell box at least 85 percent clear of other items' dense pixels, and the harness checks it from the images' alpha and colour, as it does now from polygons.
4. Assets under 1.5 MB in total (an atlas is fine), cached in `sw.js`; text and targets unchanged; the must-holds of H stand.
