# ADR-0023: Friends features: a share card, a daily seed, and "beat my run" codes

- **Date:** 2026-11-03
- **Status:** proposed, for the designer's review (not built)
- **Scope:** skeleton engine, all six games, the launcher, tools

## Context

The designer ranked the six games on LeBlanc's eight kinds of fun (2026-11-03). Every game scores 1 of 5 on **Fellowship**. The friendlies launch (`docs/release-friendlies.md`) puts the games in friends' hands, so this is the moment for features that let friends play *with each other*.

The constraints:
- No server.
- No accounts.
- Nothing sent anywhere without the player choosing to.
- One thumb, portrait (or each game's own orientation).
- Little text on screen.

Every game already seeds its content through `makeRng` (ADR-0008), so the same seed gives the same run on every phone. That is what makes the three features below cheap.

## Decision

Three features, owned by the engine and used by every game through one small API. Each game only declares what its seed means and what its score is.

### 1. The share card

- **What it is:** at a game's natural end point (a run's end, a hole's end, a day's end), a **Share** button draws a picture of the result: the game's name and icon, the headline result in large type, two or three lines of detail, the date, and the run's code (feature 3). The picture is portrait, sized for a phone message.
- **How it reaches a friend:** the phone's own share sheet (`navigator.share` with the image file). Where that is missing, the image downloads and the text copies (the Export tab's copy mechanism, ADR-0016).
- **What is sent:** nothing, unless the player taps Share and picks a friend or app.
- **Engine:** `E.share.card({ headline, lines, code, accent })` draws the card on an offscreen canvas and opens the share sheet. The game supplies only the words.

### 2. The daily seed

- **What it is:** every game has a **Daily**, the same challenge for everyone on the same day, from a seed made from the date (UTC) and the game's slug. One try counts; you can replay it, but only the first result goes on the card. A new day brings a new daily.
- **Engine:**
  - `E.daily.seed()` returns today's seed;
  - `E.daily.done()` and `E.daily.record(result)` keep today's first result in the save under an engine-owned key (as `__ledger`, ADR-0016), so `migrate` never sees it.
- **On the menu:** one tile or button, "Daily", with today's result once played.
- **The launcher:** a row reads "Today's dailies" with a tick under each game you played today.

### 3. "Beat my run" codes

- **What it is:** every share card carries a short code (for example `ARENA-K7Q2-M9`). A friend types or pastes it, under the menu's Daily button ("Enter a code"), and plays the **exact same run**: the same seed and the same setup. The friend's end card then shows both results side by side: "You 7 · Yohann 9".
- **Engine:**
  - `E.code.make(params)` packs the game slug, the game's content version, the seed, the game's few setup values and the sender's result into a short base-32 code with a checksum;
  - `E.code.read(text)` unpacks it, or says "That code isn't for this game, or this version". A code from an older version of a game opens a toast rather than a mismatched run.
- **No names are sent.** The sender's name on the friend's card is whatever the sender typed when sharing (optional, kept on their phone).

### What each game's seed and score mean

| Game | A daily or a code replays | Headline on the card |
| --- | --- | --- |
| Arena | The gauntlet seed, the arena and the body wheels' roll. The purse choice stays the player's. | Bouts won, grades, felled by whom |
| Gravity Golf | Five holes picked by the seed from unlocked sectors, with one Trial rule (when Trials exist; until then, five holes and the total strokes). | Total strokes against par, or medals |
| Ink | The day's client and stencil sequence | Pieces done and average clean percentage |
| Recoil | The target waves' seed | Score and bullseyes |
| Launch | The course, springs and birds | Distance |
| Checkpoint | The bag sequence | Score, catches and false alarms |

Each game's builder confirms the seed covers everything that makes two runs differ, so a code truly replays. Arena's purse and draft choices, and every game's player input, are the player's own.

## Consequences

- One engine change in `skeleton/src/engine.js`, copied into the six games (ADR-0006, ADR-0011), then one small layer per game. That layer declares what the seed covers, adds the Daily entry and the Share button at its end point, and shows the head-to-head result for a code. Six layer builds in all; they can run two or three at a time across games (ADR-0012).
- The share card adds one button to each game's end screen. It must not crowd an end screen the designer has already asked to be calm (Arena step 7).
- Saves gain an engine-owned key, so no game's `saveVersion` changes.
- The smoke test learns to open a game with a code and check that the run's first screen matches the sender's.
- The release channel gets the features too; they are the point of the friendlies launch.
- **Privacy:** nothing leaves the phone except what the player shares through their own share sheet. This keeps the "nothing leaves the phone" line in the privacy notes true. It also sits alongside, not instead of, the opt-in feedback form still waiting on the designer.

## Alternatives considered

- **Online leaderboards:** they need a server, accounts or anti-cheat, and a privacy statement. Too heavy for a friends launch.
- **A daily only, with no codes:** simpler, but friends can't challenge each other on a specific great run, which is the most social of the three.
- **Ghost replays** (seeing a friend's ball or fighter): fun, but recording inputs makes the code too long to type. A later layer could add them through a share link.
