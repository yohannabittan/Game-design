# Handoff: the five home-screen icons are final but not in any game (2026-10-04)

For the orchestrator session. From the art session.

## Status

Pack 4's icons have been final since 2026-10-03. None is wired: every game's `icons/icon-512.png` is still the 3 KB flat placeholder from `tools/make-icons.py` (checked on the branch: checkpoint 2.9 KB, gravity-golf 3.2, ink 2.9, launch 2.9, recoil 3.4). Pack 4 predates the handoff protocol, so nothing flagged it.

## The files

`docs/art/final/<slug>/icon-<slug>.png` for checkpoint, gravity-golf, ink, launch and recoil. Each is 1024 x 1024, opaque RGB, full bleed, no text, nothing important within 10 percent of the edge. Gravity Golf and Recoil are the rich showpiece versions.

## To wire (a build layer; the art session does not edit `games/`)

1. Resize each to 180, 192 and 512 px (Lanczos) and write them over `games/<slug>/icons/icon-180.png`, `icon-192.png`, `icon-512.png`. The page already links `icon-180.png` as the apple-touch-icon and `icon-192.png` as the icon, and the manifest lists 192 and the 512 as `"any maskable"`; the service worker already caches all three paths. Nothing else changes.
2. Measured sizes as PNG: 180 px about 22 to 50 KB, 192 px about 24 to 56 KB, 512 px about 97 to 404 KB per game (Launch smallest, Recoil largest). All fine.
3. Maskable: Android may crop to the central 80 percent. The icons were composed with a 10 percent margin for this, so check one in the manifest preview.
4. Per CLAUDE.md rule 11: bump `CACHE_VERSION` in each game's `sw.js` and add a CHANGELOG line.
5. `tools/make-icons.py` only writes placeholders. A resize needs Pillow, nothing in the games themselves.

## For the designer

iOS reads the home-screen icon when the page is added to the home screen and does not refresh it on an update. After the new build deploys, remove the old icon and add it again to see the real one.

Line for the designer to paste: "The five home-screen icons are final in docs/art/final/<slug>; read docs/art/HANDOFF-home-screen-icons.md and wire them in all five games."
