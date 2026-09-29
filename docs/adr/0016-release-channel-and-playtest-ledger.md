# ADR-0016: A release channel beside the dev channel, and a local playtest ledger with export

- **Date:** 2026-09-30
- **Status:** accepted
- **Scope:** skeleton engine, all games, tools, docs

## Context

The designer's tuning playtests use the TUNE tab, presets and experiments. Shareable builds for other people must not: a slider changes the game under the tester, and a tester's notes are worth less when the defaults were not the defaults. Feedback from others also needs numbers the game can record itself (strokes, attempts, scores), because "40 shots" from memory is not a measurement, and there is no backend (ADR-0005).

## Decision

1. **Two channels on one Pages site.** The working branch root stays the dev channel. A `release/` folder on the same branch carries the shareable build: `release/index.html` (launcher) and `release/games/<slug>/` copies made by `tools/release.sh <version>`. The script copies each game whose `games/index.json` entry is marked `release: true`, writes `<meta name="channel" content="release">` and `<meta name="release-version" content="vX.Y">` into the copied `index.html`, rewrites the copied `sw.js` cache name to `<slug>-release-<version>` and its scope to the release path, and prefixes the copied `manifest.webmanifest` name with the version. It refuses to copy a game whose changelog's latest layer says "Review: pending".
2. **The engine reads the channel.** `E.channel` is `'release'` or `'dev'` from the meta tag. In release: the TUNE tab is hidden and opens only after five taps on the game title within two seconds; saved tune values are ignored (the game runs on TUNING as shipped); the save key is `<slug>.release` so release and dev saves never mix; the launcher shows the release version. Games must check `E.channel` for any TUNE-like screen they draw themselves (Recoil's own TUNE screen).
3. **A local playtest ledger.** The engine keeps `E.ledger`, an append-only local record per game (capped at 200 entries, oldest dropped) that the game writes through `E.ledger.add(kind, data)` at natural points: a level or challenge result, a retry, a quit mid-run, a badge. It is saved with the save under `__ledger` and survives reloads. An **Export** button on the menu (both channels) shows a plain-text block: game, channel, version, device size, date, then one line per entry, and a "Copy" that uses the clipboard when available with a select-all fallback. Nothing leaves the device unless the tester pastes it.
4. **Feedback from others is a separate stream.** `templates/playtest-external.md` (five plain-language lines plus the pasted export) goes into `docs/playtests-external/YYYY-MM-DD-<name>-<slug>.md`. External reports never change a default by themselves; they feed a PRD like the designer's reports do. Experiments and presets exist only in the dev channel; release ships one value.

## Consequences

- Builders add ledger calls at the points the layer prompt names; the reviewer checks that a run's export lists every result.
- Every game's `engine.js` is refreshed from the skeleton in the same round (ADR-0011).
- The release script is the only way into `release/`; hand-edited release files are a process failure.
- The engine draws the EXPORT tab at the top left of the menu (72 x 44), so a game's menu keeps that corner clear, as it already does for the TUNE tab at the top right. Recoil's landscape menu title sits under it and needs to move.
- The release title-tap band is the top strip of the menu (safe top plus the larger of 110 px and 16 percent of the height), clear of both tabs; a game whose title lives elsewhere sets `E.titleArea`. Taps in the band still reach the scene until the fifth, which is consumed.
- `tools/release.sh` reads the newest layer line of the highest version in a changelog (the first bullet when sections run newest-first, else the last) and refuses the game on "Review: pending". A refused game is left out of `release/games/` and any earlier copy is removed, so the launcher's single version never labels a game it did not build; the script exits 2. The release folder is rebuilt from sources on every run and is idempotent. `release/release.json` lets the dev launcher show a link only when a release exists.
- `E.ledger` and `__ledger` are engine-owned: `migrate` never sees the key and `E.save.reset()` keeps it.
- `tools/smoke.mjs` also boots every `release/games/<slug>` present and checks the release meta, cache name, manifest prefix, save key and hidden TUNE tab.
