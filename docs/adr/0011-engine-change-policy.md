# ADR-0011: Additive engine changes need a README entry; behavioural changes need an ADR

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** skeleton

## Context

The first review of a built layer (Gravity Golf layer 1) found two gaps in the engine contract: a cancelled pointer (palm, system gesture) reached the scene as a normal release, and the named sounds had no volume control, so a PRD line asking for a quiet bounce could not be honoured from `game.js`. Both are small additive fixes. Requiring a full ADR for every helper or field added to the engine (ADR-0001's wording) would slow the loop the engine exists to serve, while silently changing existing behaviour would break games nobody is replaying.

## Decision

Engine changes fall in two classes:

- **Additive.** A new field, helper, option or named sound that no existing game could have relied on. Needs: the change in `skeleton/src/engine.js`, a row or note in `skeleton/README.md`, and a copy into the game being worked on. No ADR.
- **Behavioural.** Anything that changes what an existing call does, removes something, or alters timing, input, save or audio semantics. Needs an ADR before it lands, and every game that gets the new engine copy is smoke-tested and played.

Either way the engine is copied into a game only when that game is being worked on (ADR-0006).

Changes made under this ADR today, all additive: `p.cancelled` on pointer up; `E.audio.play(name, vol)`; the safe-area inset is cached per resize instead of read from computed style every frame.

## Consequences

- Builders and reviewers can propose small engine additions without ceremony, and the README stays the single contract.
- Behavioural drift still gets the scrutiny it needs.
- Reviewers should classify any engine change they see in a diff as additive or behavioural and flag a behavioural one without an ADR as blocking.

## Alternatives considered

- ADR for everything: too slow for one-line helpers, and the ADR index fills with noise.
- No ADR for anything: the failure mode ADR-0006 was written to prevent.
