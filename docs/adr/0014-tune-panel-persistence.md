# ADR-0014: The tune panel restores only declared keys, prunes the rest, and Reset restores every declared key

- **Date:** 2026-09-29
- **Status:** accepted
- **Scope:** skeleton, all games

## Context

The tune panel (an additive engine feature under ADR-0011) saved slider values per game. When presets were added, the engine was changed to restore every saved key so preset-only values would persist. That was a behavioural change and it landed without an ADR, copied into every game. The Recoil v0.2 review found the consequence: a phone that had used the layer 1 sliders (approach speed, drag gain) kept those values silently applied in v0.2, where the sliders no longer existed and Reset could not touch them.

## Decision

- The declared tune keys of a build are the experiment slider keys plus every key any preset sets.
- On start, only declared keys are restored from the saved tune. Undeclared saved keys are removed from the save at that moment.
- Reset restores every declared key to the value the build shipped with, sliders and preset-only keys alike, and clears the saved tune.
- The TUNE tab and panel keep clear of the safe-area insets on all sides.
- A behavioural change to the tune panel, or to any engine feature, gets an ADR before it is copied into a game (ADR-0011 restated). Copying an engine change into a game is part of working on that game and is followed by that game's smoke test.

## Consequences

- A designer's phone never carries a stale experiment into a later build; retiring a slider retires its value.
- Preset-only values persist, which was the point of the earlier change, without the side effect.
- Builders can rely on TUNING defaults being what the player has unless a declared key is set.

## Alternatives considered

- Restore only slider keys (the original behaviour): preset-only values would not persist across a reload.
- Restore everything (the interim behaviour): stale values apply silently. Rejected by the review that found it.
