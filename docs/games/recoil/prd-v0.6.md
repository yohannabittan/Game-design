# Recoil PRD v0.6: Backlot 88, a movie-studio range with a prop room

Status: locked 2026-09-30. Builds on v0.5 through section Q. Source: the designer's v21 playtest ("way better and entertaining; missing an art theme") and three decisions in chat: an 80s Hollywood studio where you train as an action actor, guns as iconic movie props, and guns bought in a store with in-game currency ("the first one free, most bought, some unlocked with high-level missions"). Scope of this build: theme, store, reskins. The two new guns and the spin reload are v0.7.

## A. The world: Backlot 88

You are an unknown actor training on a 1988 studio backlot to become an action star. The game keeps its name, Recoil; the menu's title card reads like a studio logo ("RECOIL" over "a Backlot 88 production"). Each mode is a set, drawn procedurally on the canvas, with its own backdrop, palette and props. The rules, targets, timings, hit boxes and star bars do not change; only the drawing does.

| Mode | Set | Targets become |
| --- | --- | --- |
| Accuracy | Screen test: a soundstage with a painted city backdrop, a camera on a dolly | cardboard villain cut-outs on dolly tracks (the rails are the tracks) |
| Speed | Western street facade, saloon windows and doors | extras in hats popping out of windows and doors, painted on boards |
| Skeet | B-movie sci-fi stage, starfield flat and a painted planet | flying saucers on wires (the wire drawn faintly from the top edge; a hit sparks and drops the saucer) |
| Boss | Monster soundstage | a giant rubber-suit monster or animatronic robot; its existing weak parts are its exposed machinery |
| Zombies | Horror set: graveyard flats, fog machine, a picket fence | extras in zombie make-up; a headshot pops a make-up squib |
| Endless | Night shoot: the same sets under floodlights | as its set |

- A clapperboard snaps "Action!" at the start of a run and "Cut!" at the end (under 0.6 s each, never delaying input).
- Readability beats theme: every target keeps at least 3:1 contrast against its set, hit zones (bullseye, brain, weak part) stay as visible as in v21, and the backdrop never uses the target's colours.

## B. The Prop Room (store)

- A new screen from the menu: a counter with the prop master behind it and the guns on a pegboard wall, each with its movie name, a price tag, its stats (from the v0.5 C stats) and a Buy button with the price in it. Locked guns that come from a mission show the mission's name instead of a price.
- **Currency: box office**, shown as dollars ("$1,240"). Every run pays box office from its score and stars (`boxPerPoint`, `boxPerStar`), shown on the card as a ticket-style line ("Box office +$120"). The menu's one headline number (principle 11) stays the selected gun's stars; box office shows on the Prop Room screen and on the card.
- **Which guns are how:**
  - Buddy-Cop 9mm (the service pistol): free, always owned.
  - Pulse Rifle (carbine), Spin-Lever Shotgun (shotgun), Assassin's Scope (marksman rifle), Commando SMG (SMG): bought, prices rising in that order (`gunPrices`).
  - Make-My-Day .44 (revolver): unlocked by a high-level mission, moved from its current badge to a Blockbuster-tier badge (the builder picks the Blockbuster badge a good player earns first and names it in the changelog).
- **Pacing (harness):** with the v0.5 noisy bots, a careless player affords the first purchase within 5 runs and a good player within 3; every bought gun is some player's best next buy at some point; buying is never needed for any star (each rung's three stars stay reachable with the free pistol, as the naked-run rule).
- **Migration:** every gun already unlocked stays owned (a gun is never taken away); badges earned keep counting. Box office starts at `boxStart` plus a one-time credit for stars already earned (`boxPerStar` each), so a veteran can shop at once.
- Skins stay earned by skill (mastery tiers and trick badges), never bought.

## C. Reskins and names in the studio's trade

- **Guns:** each keeps its handling and gets a movie-prop look and name (above). Names are parodies; no real film title, actor or logo appears anywhere.
- **Badge tiers** (principle 11, rule 8): Plinker, Sharpshooter, Deadeye and Trick Shot become B-Movie, Box Office, Blockbuster and Cult Classic. Badge names may be renamed in the trade where a name fits better ("Quick Draw I" can stay; "Clay I" becomes "Saucer Shooter I"); conditions stay plain and unchanged in meaning.
- **Mastery tiers:** Marksman, Expert and Master become Stunt Double, Leading Role and Walk of Fame (a gold star on the pavement on the stats card). The numbers behind them do not change.
- **End card:** "That's a wrap!" as the title; the stars read as critic stars, with one line of review under them chosen from a small pool per star count (for example three stars "'Explosive!' — The Daily Reel", one star "'Wooden.' — Tinseltown Weekly"; the choice is cosmetic, `Math.random` is fine). Tickets become call sheets (the ticket shape of section Q, restyled).
- **Menu:** the gun rack becomes a prop rack, the lanes are labelled by their set as well as their mode ("Speed: Western Street"), VHS scan lines on the menu background only, never over play.

## D. Look

- Style sentence (also the image anchor in `style.md`): "80s movie-studio backlot at night, chunky flat vector with thick dark outlines, dark soundstages lit by neon pink and teal, painted-flat sets, one orange accent for the player, strong readable silhouettes, no text, no photorealism."
- Orange stays the player's colour (shots, primary buttons). Neon pink and teal are set lighting only, never on targets.
- All art is procedural canvas (generated images wait on the image key).

## E. Out of scope (v0.7 and later)

The Golden Gun and Ray Gun, the spin-lever flourish reload, new genre sets as new content (kung-fu, cop thriller, pirate, space opera), music, generated image assets, any change to rules, targets, hit boxes, star bars or mastery numbers, real-money anything.

## F. Acceptance

- Every mode's set drawn at 640x360 and 844x390, targets and hit zones at least 3:1 against their set (measured, table in the changelog).
- Prop Room pacing targets met in the harness, with a table.
- Migration from a v12 save keeps every owned gun, skin and badge; box office credited.
- Text counts per principle 11 on the menu, the Prop Room and the card, in the changelog.
- First menu frame under 40 ms at 4x CPU throttle; play frame time not worse than v22 by more than 10 percent with the sets drawn.
- `npm run smoke` passes; no console errors in a run of every mode.
