# All Who Wander (inspiration, read 2026-11-19)

**What the designer said:** "That was a seriously good roguelike, with generated maps and 30 days until a final boss." Cited already in `docs/design-principles.md` (smart randomness) and `docs/pattern-library.md` (L1, run structure).

**The game** (itch.io page, by one developer, frumpydoodle): "Traditional roguelike & dungeon crawler RPG. Every run is a new adventure." Turn-based, fantasy, 3D; released, and still updated.

## Its devlog, update v1.3.2 (2026-09-10), what it shows

The whole post: a two-line intro, then the changes under headings (Creatures, Abilities, QoL, Misc, UI, Bug fixes):
- 2 new creatures; Polymorph limited to 5 uses per day;
- **bad-luck protection:** "The 50% chance for the Confusion status effect now has manipulated odds. The more failures in a row the more likely you are to succeed, and vice versa";
- a setting to turn off the exit confirmation; a swap-weapons button on the inventory screen; naming your character;
- an improved Rankings screen; inspecting a unit shows its type (Animal, Undead...);
- a fix for UI overflowing on tablet and iPad screens.

The post list shows an update about every month for a year (v1.2.8 in Dec 2025 to v1.3.2 in Sep 2026).

## What we can learn

1. **Small, steady updates with a plain, sorted changelog.** A couple of new creatures and a handful of fixes a month keep a released game alive. Ours is the What's new card; sorting lines by kind (new, easier, fixed) would read the same way.
2. **Content grows two at a time.** Variety comes from many small additions to a combinatorial pool, not big drops.
3. **Fair-feeling luck:** a coin flip that "remembers" a run of failures. Arena keeps randomness out of resolution, but its setup luck (the draft's rarity, the gauntlet's rolls) could carry the same protection: no third bad deal in a row.
4. **Days as a budget:** an ability limited per day makes the day the unit of planning (relevant to a "30 days to the Games" idea).
5. **Little comforts count:** naming your fighter, one-tap weapon swap, fewer confirmations, the screen fitting every device (we check two phone sizes; not tablets).
6. **Clarity on inspect:** telling the player what a thing is (its type) when they look at it.
