# Overnight plan, 2026-09-29

Designer's brief: all three games have good mechanics and potential; they need more gamification and more content. Keep iterating on content, look and feel, levels, missions, and design experiments to test together tomorrow.

Rules for the night: one builder per game file at a time; content shards produce data only; every push passes the smoke test; every experiment ships as presets on the TUNE tab; nothing changes a proven mechanic without a PRD delta. A morning summary lands in `docs/plans/2026-09-30-morning.md` with what to play and what to judge.

## Gravity Golf

1. Merge Windmill and Eclipse when shard C hands back; sequence review of all ten holes.
2. Art layer (layer 5): the space motif. Parallax starfield and nebula, planets with bands, craters and rings distinct by mass, suns with corona, moons pale, the ball with character (highlight, speed glow, shadow), and the range finder redesigned as a first-class element. Physics and level data byte-identical.
3. v0.3 mechanic delta: comets (fast bodies crossing on the clock, hard bounce, no gravity) and black holes (swallow the ball: one penalty stroke and reset to the last rest). PRD v0.3.
4. Content: holes 11 to 15 using comets and black holes, sharded, proven by the harness.
5. Missions (progression layer): themed badge tiers (meteorite, moon, planet, star), earned by skill acts: an ace on each boss, a full run without landing on a planet, a run under a stroke total, three stars on every hole. A missions screen on the menu.
6. Experiment for tomorrow: field feel presets, "Ice" (low friction), "Turf" (current), "Sand" (high friction), with sliders for friction and cup capture.

## Ink

1. Art layer (layer 5): skin field with subtle texture, a flash-sheet frame, story elements on the gem (facet line), heart (banner), star (swirl), hand-drawn outline wobble, ink bleed at edges, menu tiles as flash cards. Attempt a calligraphy "Ink" logo as an image asset; fall back to strong typography if the asset route fails.
2. Body parts: a soft-shaded forearm, calf or shoulder behind each stencil, chosen per stencil in data.
3. Content: five new stencils by shards, proven by the harness: anchor, rose, dagger, swallow, skull. Ladder positions decided by their measured difficulty.
4. Missions: badge tiers (apprentice, artist, master), for clean passes, five-star sets, the snake clean, and a daily stencil mode (the day's stencil with a tighter timer, seeded by date).
5. Experiment for tomorrow: timer feel presets, "Relaxed" (2.6x), "Standard" (current), "Tight" (1.6x), applied to all stencils.

## Recoil

1. Apply the v0.2 review findings.
2. Progression layer: the unlock table with points gating, two more guns (a shotgun: damage 1 per pellet with a wide spread pattern that is deterministic, short range finder; a marksman rifle: damage 3, slow, full range finder, big kick), and the gun select showing what each unlocks at.
3. Missions: badge tiers per ladder, and a "gauntlet" mission that chains one level of each ladder.
4. Art layer: the gun as a proper silhouette per gun, targets with a paper-target look, tracer and muzzle flash styled, a range backdrop with a horizon.
5. Experiment for tomorrow: handling presets, "Steady" (low kick, low sway), "Standard", "Wild" (high kick, high sway).

## Order of operations

Gravity Golf art and Ink art start now (files are free). Ink stencil shards start now (data only). Recoil waits for its reviewer, then fixes, then progression. Gravity Golf v0.3 objects wait for the art layer to land. Missions layers run last on each game. Reviews after every layer.
