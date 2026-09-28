# ADR-0002: Plain HTML5 Canvas and vanilla JavaScript, no engine, no build step

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

Goals: one-shot builds, fast iteration on content and numbers, offline play on a phone, a solo developer. Game engines (Phaser, Godot, Unity) bring power and also a build toolchain, version drift, and a large API surface a builder session has to get right on the first try. The games targeted are small: one verb, a few hundred lines of logic.

## Decision

Every game is plain HTML, the 2D Canvas API, and vanilla ES modules. No framework, no bundler, no transpiler, no npm dependencies at runtime. The only dev dependency is Playwright for the smoke test.

## Consequences

- A game is a folder you can open in a browser. Deploy is a push. Anyone can read the whole thing.
- The shared engine (`skeleton/src/engine.js`) has to provide what an engine would: loop, input, scenes, save, audio, particles. It is small on purpose and grows only by ADR.
- Physics is hand-written per game. This is fine at the scale targeted and is part of what makes each mechanic feel specific. If a game genuinely needs a physics library, that is a new ADR for that game.
- WebGL, 3D, and heavy sprite pipelines are out of scope. This is a deliberate ceiling.

## Alternatives considered

- Phaser: good fit for 2D, but adds a build and a large API for the builder to get right. Revisit if games outgrow Canvas.
- Godot with web export: strong, but the export size and the editor-centric workflow fight the one-shot goal.
- React or a UI framework: wrong tool for a canvas game loop.
