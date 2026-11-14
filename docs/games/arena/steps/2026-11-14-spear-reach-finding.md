# Spear reach: a finding (2026-11-14, arena-v69, 874x402)

**Verdict: it is as long as designed, and the design is short.** The spear reaches 1.35x a gladius, but the gladius's blade is only 0.36 H, so that is +0.13 H (+24 to +27 px at this screen), and three things then take it back. Measured from the running game; no code changed. Scripts and stills: `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/spear-reach/` (`measure.mjs`, `stills.mjs`, `off.mjs`, `reach-self.json`).

## Where the point gets to (px forward of your anchor; the frame is H = 246 px for all rows)

| Body, weapon | Blade drawn | At rest | Full jab | Full lunge (jab + stride) |
| --- | --- | --- | --- | --- |
| Lean (stats 1/5/2), gladius | 80 | 155 | 184 | 252 |
| **Lean, spear** (spear and shield, or two spears: identical) | 108 | **179** | **211** | **279** |
| Lean, dagger | 52 | 132 | 158 | 225 |
| Medium, gladius | 91 | 181 | 215 | 292 |
| Medium, spear | 123 | 207 | 245 | 322 |

Game units: lean spear is 0.73 H at rest, 0.86 H jabbing, 1.13 H lunging; gladius 0.63 / 0.75 / 1.02. A lunge adds a fixed stride (0.3 H x your scale = 67 px lean); holding it adds up to 67 px more (the drive).

## Where the foe stands (nearest part of him to you, px forward of your anchor, at his rest stance)

| Foe | Nearest part | Lean spear jab falls short by | Lean gladius jab falls short by |
| --- | --- | --- | --- |
| Man with a sword | 217 | 6 (touches) | 33 |
| Man with a spear | 272 | **61** | 88 |
| Lion (adult, rack 3) | 210 | 0 to 15 | 39 |

The camera does not slide: H is 246 px for every sword and spear row (a lion makes it 228). Foes stand off by their own weapon's `range` (spear 0.34, gladius 0.12, lion 0.03), whatever you hold.

## Why it feels short

1. **The gain is small and a lean body eats it.** `blade.len` 0.36 x `reach` 1.35. A lean body draws at scale 0.88 with arm x0.95, so a lean spear (179 at rest) reaches no further than a medium gladius (181). `TUNING.sizes` `reach` is a foe-only number; yours is never used, so lean costs you only through scale and arm, 12 to 16 percent.
2. **Spear foes stand 54 px further off than sword foes** (0.22 H), twice what your spear adds (24). Against a spearman your jab falls short by 61 px, more than a gladius against a swordsman (33). A lunge is the only thing that closes it, which fits 33 lunges, 6 jabs and `chases=10`.
3. **His spear is drawn twice as long as yours.** A foe's spear is `len` 0.8 H + 0.12 H head = 226 px ahead of his fist. Yours is `blade`, 108 px ahead of the fist (and 30 px behind it: the fist is a fifth from the butt, not mid-shaft). In the rest still his shaft runs off the bottom of the screen beside your short one. At rest your spear also cocks up about 35 degrees, so less of it points at him.

## What is not wrong

- **The hit lands where the point is drawn.** `checkHits` scans from the tip back to the fist along the drawn blade. The spear head is the first 224 of 1400 art px (16 percent, about 17 px), the rest is haft; a haft-first contact is a THUD, which only happens if the point slips past a part.
- **Two spears do not change the main hand**: rest, jab, lunge and pose were identical to spear and shield.
- **The off hand's follow-up is for show.** `updateOff` lands the hit on the part the slash cut, whatever the distance. Drawn, its fist goes to 0.32 H and the spear reaches about 179 px, level with your rest point, so it ends 40 to 55 px short of him (`still-spearx2-offhand-followup.png`) while the damage lands anyway. At rest the second spear hangs point-down at the hip (visible in every still).

## Stills (lean, two spears first, gladius second; foe a man with a sword)

- Lunge: `.../spear-reach/compare-lean-lunge.png` (parts: `still-spearx2-lean-lunge.png`, `still-gladius-lean-lunge.png`)
- Full jab: `.../spear-reach/compare-lean-jab.png`
- Against a spearman at rest: `.../spear-reach/still-spearx2-lean-vs-spear-rest.png`

## Cheapest changes (one number each, then a look and a feel check by the designer)

1. **`TUNING.me.weapons.spear.reach` 1.35 to about 1.9** (the trident at 1.5 would then be shorter than the spear: raise it too). Blade becomes 0.68 H, 152 px lean, so rest 223, jab 255, lunge 323: past the spearman's 272. It also draws the spear as long as his. `camSpan` reads this value, so the frame zooms out for it; check 667x375 and the wall.
2. **`TUNING.weapons` spear `range` 0.34 to about 0.22** (and `strike` 0.2 to 0.1): spearmen stand 30 px nearer, so every weapon of yours gains against them. Smaller effect, and it also weakens his threat. Do it only if 1 is too much.

## Not measured

Real thumb arcs (strokes were horizontal, so jabs are a best case); slashes and overheads; the young lion (used the adult); where a live foe steps to when he swings; any feel. Foes' weapon `len` was read from tuning, the drawn length from stills, not pixel-measured. Nothing committed.

**Still:** `../sketches/spear-yours-vs-his.png` (your two spears on the left, a foe's spear on the right, both at rest).
