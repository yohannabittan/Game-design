# ADR-0010: A top-tier model plans and reviews; cheaper, faster models build layers as sub-agents

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** process, all games

## Context

Each build layer is a closed, well-specified task (ADR-0007): a PRD, a fixed engine contract, one file to write, an acceptance list, and a smoke test. That is exactly the shape of work where a faster, cheaper model does as well as the most capable one, provided the spec is good. Planning, design judgment, and review are where the most capable model earns its price: writing the PRD, deciding what is in scope, catching a violated design principle, diagnosing why a layer failed.

Claude Code's `Agent` tool can run a sub-agent on a chosen model (`fable`, `opus`, `sonnet`, `haiku`) in the background, and several sub-agents can run in parallel. Approximate per-token prices as of September 2026, from Anthropic's published rates, for orientation only:

| Model | Input per 1M tokens | Output per 1M tokens | Role here |
| --- | --- | --- | --- |
| Claude Fable 5.1 | $10 | $50 | Orchestrator: planning, PRDs, review, diagnosis |
| Claude Opus 5.5 | $4 | $20 | Builder for high-risk layers (feel-heavy mechanics, physics) |
| Claude Sonnet 5.5 | $2 | $10 | Default builder for layers |
| Claude Haiku 4.5 | $1 | $5 | Mechanical tasks: icon regeneration, changelog entries, data transforms |

## Decision

1. **The orchestrator session** (the one you talk to, on the most capable model available) owns everything that requires judgment: concept cards, PRDs, deciding scope, choosing which layer runs next, reviewing a builder's output against the PRD and the design principles, and diagnosing failures. It does not write `game.js` itself unless a builder has failed twice.
2. **Builder sub-agents** run layer prompts. Default model is Sonnet. Use Opus for layers flagged medium or high risk in the pattern library (momentum platforming, physics destruction, the mechanic layer of anything feel-critical). Haiku for chores. The layer prompt is handed to the builder verbatim with placeholders filled; the builder reads the repo itself.
3. **A reviewer sub-agent** (`prompts/08-review.md`) runs after every builder, on Sonnet, with fresh context: it checks the output against the PRD, the design principles, the hard rules in `CLAUDE.md`, runs the smoke test, and reports violations with file and line. It does not edit. The orchestrator reads the report and decides: accept, send back to the builder with the findings, or fix the PRD.
4. **Escalation ladder.** A layer that fails review goes back to the same builder once with the findings. A second failure re-runs on the next model up. A third failure means the PRD or prompt is at fault; the orchestrator fixes the document, not the code.
5. **Parallelism is across games, not within one.** Layers on one game are sequential because they rewrite one file. Two or three games can have builders running at once. The reviewer for one game can run while the builder for another works.
6. **Measure before assuming.** Log in each game's changelog which model built each layer and whether it passed review first time. If Sonnet's first-pass rate on a layer type is poor, the default for that layer type moves up. If Opus is landing everything first time on mechanic layers, try Sonnet there at higher effort before concluding it needs Opus.

## Consequences

- Layer builds get cheaper by roughly a factor of five per token and faster in wall clock, and the orchestrator's context stays clean of code, which keeps its judgment sharp on the documents.
- The documents have to be good. This ADR only works because ADR-0007 made each layer a closed task. A vague PRD will fail on any model; the fix is always the document.
- Review is a separate step with a separate context, which is the thing that catches most one-shot failures. It costs one extra Sonnet run per layer and is worth it.
- Cost per completed layer is the metric, not cost per token. A cheap builder that needs three rounds is more expensive than a mid-tier builder that lands in one.
- `CLAUDE.md` gains an orchestration section so any session in this repo knows the roles. The process doc's Stage 4 references it.

## Alternatives considered

- Everything on the top model: simplest, highest quality per call, roughly five times the cost on the mechanical layers, and the orchestrator's context fills with code.
- Everything on the cheap model: planning and review quality drop, and those are where the leverage is.
- Builders on the top model at low effort instead of a cheaper model: worth measuring per point 6; the published guidance is that a stronger model at lower effort sometimes beats a weaker model at high effort. The ladder in point 4 allows either.
