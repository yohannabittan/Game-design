# ADR-0004: Touch-first, portrait, one thumb; keyboard is a fallback

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

The Flash originals were mouse and keyboard. Retrofitting touch onto a mouse design is where most ports die: hover disappears, precision drops, the finger covers what it points at. The target device is a phone held in one hand.

## Decision

Every game is designed for portrait, touch, one thumb. The PRD's control section is written in gestures (tap, drag, release, hold). The engine unifies touch and mouse through pointer events so desktop testing works, and keyboard handlers exist only as a fallback for testing. Occlusion (the thumb hiding the judged object) is a required section in the PRD.

## Consequences

- Some inspirations need redesign, not porting: twin-stick shooters become auto-aim or recoil-driven; platformers become auto-run.
- Touch targets are at least 44 px; HUD lives inside the safe area; text is at least 14 px.
- The engine disables page scroll, zoom, long-press menus, and text selection on the canvas.
- Landscape is not supported in v0.1 of any game. The manifest locks portrait.

## Alternatives considered

- Desktop-first, touch later: the failure mode this ADR exists to prevent.
- Support both orientations: doubles layout work for no gain at this stage.
