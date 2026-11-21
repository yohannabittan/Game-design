# Launch playtest, 2026-11-21: a first-time player

**Who:** the designer and a first-time player, together. Dev channel export (402x812, 200 entries); today's flights 511 to 3734 m.

## What they said
- No tutorial: she didn't know the controls or what to look out for.
- Caramel is a disappointing end to a flight.
- She passed Daifuku's house but could barely see it, and there was no ending scene. The design said Mochi and Daifuku carry on the journey together once you reach her.

## What the code says
- **Lessons:** the first-minute lessons (launch-v19) show only on a save with no flights. The friends' release (v1.6) predates them, so a new player on the release link gets none; on the designer's phone the save has 150+ flights, so none either. There is no way to hand the phone to someone new.
- **Caramel:** a touch on caramel ends the flight on the spot (`end(r, 'mud')`): a squash and the result card. Most of today's flights ended there (why=mud).
- **The house:** the cottage is a 90-unit shopfront 120 units past the 5000 m line, drawn at the flight's zoom (down to 0.3 at speed), so it can be about 30 px wide.
- **The scene:** the proposal plays once per save, after the flight that reaches Tea Party. This save saw it on an earlier day (6593 m). After it, Daifuku leaves the cottage and appears only on the menu and the journey strip, never in a flight. So "together" is not visible in play.
