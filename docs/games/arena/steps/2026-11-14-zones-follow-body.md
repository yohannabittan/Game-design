# Arena step: the warning sits on your body, whatever your size (locked 2026-11-14)

**The designer:** "If I'm a runt, the big blocking buttons are not actually matching where I'm about to get hit, and it's a bit disturbing."

**What was found** (`2026-11-14-runt-zones-finding.md`, sheet `../sketches/runt-zones.png`): the warning glow, the impact ring and the streak are drawn at a medium body's heights. Your shield is drawn at your own. So on a runt the HIGH glow floats above the head and the MID glow sits on the head; on a giant the HIGH glow sits near the chest. The block is judged by zone, so the right button always works, but the picture points at the wrong one.

## What the player gets

- The HIGH warning sits on your head, MID on your chest, LOW on your legs, for every body size from runt to giant. The same for the ring and sparks where a blow lands or is blocked.
- Nothing about what is judged changes: zones, timing, damage and the buttons stay as they are.

## Acceptance

1. At 874x402 and 667x375, for a runt, a lean, a medium, a big and a giant fighter, each zone's glow is within 12 px of the height your shield is drawn at when raised to that zone.
2. A medium fighter looks as it does today (within 3 px).
3. `npm run check arena` passes; any replay hash that changes is named, not accepted. (A drawing change should not move one.)
4. One contact sheet of the nine tells (runt, medium, giant by HIGH, MID, LOW), as in the finding, for the designer.

## Open, simplest option taken

- The foe's weapon still swings at his own height, so against a runt his blow will be seen to come down onto the glow. Not changed here.
- The three buttons are thirds of the column and match no body's head, chest and legs. Not changed here.
