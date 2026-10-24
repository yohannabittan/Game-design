# Friendlies launch: release v1.6 (plan, 2026-10-24)

The designer's decisions, 2026-10-24:
- **Who:** a launch to friendlies first, a closed beta of friends on the release link. The public launch comes after it.
- **Price:** free for now.
- **Which games:** all six.

The friendlies play the **release channel** (ADR-0016) at `https://yohannabittan.github.io/Game-design/release/`. The last cut was v1.5, on 2026-10-12. Every game has moved on since, so the friendlies get a fresh cut, v1.6, once the blockers below are cleared.

## Blockers for v1.6

| # | Game | Blocker | Needs |
| --- | --- | --- | --- |
| 1 | Arena | **No painted art in release.** The release channel never loads art candidates (ADR-0020); all 132 Arena assets are still candidates (31 MB), with none in `docs/art/final/arena/` or `games/arena/assets/`. A release Arena today shows the drawn fallback figures. | The designer's picks from the ART tab (or "ship what the dev build shows now"). Then a finals build copies the picks, compressed, into `games/arena/assets/` and loads them in both channels. |
| 2 | Arena | The black band at the bottom of the screen. | The designer: the home-screen app or Safari? Does rotating the phone fix it? Then an engine re-measure fix (skeleton plus an ADR, copied into the games). |
| 3 | Gravity Golf | The "Read it" holes against Expert mode. | The designer: option 1 (remove "Read it" and keep the 0.2 s line everywhere; Expert is the only blind mode) or option 2 (keep it and make Expert stricter). |
| 4 | All | The launcher is a plain list. | One build: on `release/index.html`, a line on adding a game to the home screen and a line on sending feedback (tap EXPORT on a game's menu and send it to the designer, with a few words). |
| 5 | All | The release gate. | `tools/release.sh v1.6`. Smoke the release builds at phone sizes. A quick look at each game's first run in release (no TUNE, no ART tab, no dev text). |

## Feedback from friendlies

- Each friend plays, then sends the EXPORT text and a few lines (`templates/playtest-external.md`: what they played, what was fun, where they got stuck, what confused them, would they play again).
- The designer forwards it into this session. It is filed under `docs/playtests-external/YYYY-MM-DD-<name>-<slug>.md`.
- External reports never change a default by themselves. They feed a PRD (ADR-0016).

## Before the public launch, not for friendlies

- **A clean public home:** release builds only, on their own site or repo (ideally a custom domain). The working repo goes private. Today the working repo is public and also holds the dev builds, the art candidates, the playtest notes and the cost ledger.
- **Rights:**
  - the image service's terms for commercial use of generated art, and a record of what made each asset (`docs/assets-ledger.md` is the start);
  - a trademark check on the six game names.
- **A short privacy statement:** today nothing leaves the phone. Any stats ping changes that and needs consent.
- **Learning from strangers:** an opt-in anonymous stats ping, a feedback button, or both. This is a decision for after the friendlies.
- **Identity:**
  - a name for the collection;
  - a landing page;
  - icons, screenshots and a short clip for each game.
- **Platform:** web first, then app stores for the games that hold players.
