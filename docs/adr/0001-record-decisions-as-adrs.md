# ADR-0001: Record architecture decisions as ADRs

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

Games here are built by fresh Claude sessions working from documents. A decision made in one session is invisible to the next unless it is written down where the next session will read it. Re-deciding costs time and produces drift between games.

## Decision

Every decision that constrains how games are built is recorded as a short ADR in `docs/adr/`, indexed in its README, and referenced from `CLAUDE.md` so builder sessions read them.

## Consequences

- Builder sessions have a fixed set of constraints to work within and a place to propose changes.
- Slightly more ceremony when changing the skeleton or the process.
- `CLAUDE.md` must tell sessions to read the ADR index and to write an ADR before deviating.

## Alternatives considered

- Keep decisions in the README: gets long, and history of why is lost.
- Keep them in chat: lost by the next session.
