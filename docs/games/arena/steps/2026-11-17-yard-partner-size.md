# Arena step: the training partner is your size (locked 2026-11-17)

**The designer:** "When I played the training recently the training guy was small, so he sat below my normal arm, which made it harder to hit him. Maybe the training dummy should be equal size."

**Found:** the yard (`features/yard.js`, `startYard`) trains you against the run's first foe as rolled, at his own size, so a runt partner sits below your arm's reach line.

## What the player gets

- In the training yard, the partner is **your size** (same `size` band and reach as you), whatever the first bout's foe will be. The lessons' heights and gaps sit where your arm naturally goes.
- When training ends, the first real bout's foe is his rolled size, as today.

## Acceptance

1. A runt, medium and giant you each train against a partner of your own size; the first bout's foe after the yard is unchanged (same size, seed and look as without the yard).
2. Every yard step completes at 874x402 and 667x375 for a runt and a giant (`tools/checks/arena/yard.mjs`, extended).
3. Replay hashes unchanged (replays don't use the yard); saves unchanged.
