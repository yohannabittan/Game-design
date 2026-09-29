#!/usr/bin/env bash
# Create a new game from the skeleton.
# Usage: tools/new-game.sh <slug> "<Title>" [hex-color]
# Result: games/<slug>/ ready to run, plus docs/games/<slug>/ with a PRD stub.
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?slug (kebab-case)}"; TITLE="${2:?title}"; COLOR="${3:-3b82f6}"
SHORT="$(echo "$TITLE" | cut -c1-12)"
DEST="games/$SLUG"
[ -e "$DEST" ] && { echo "$DEST already exists" >&2; exit 1; }
cp -r skeleton "$DEST"
sed -i "s/GAME_TITLE/$TITLE/g; s/GAME_SHORT/$SHORT/g; s/GAME_SLUG/$SLUG/g; s/GAME_DESCRIPTION/$TITLE - a small skill game/g" \
  "$DEST/index.html" "$DEST/manifest.webmanifest" "$DEST/sw.js" "$DEST/src/game.js"
rm -f "$DEST/README.md"
python3 tools/make-icons.py "$DEST" "$COLOR" "${TITLE:0:1}"
mkdir -p "docs/games/$SLUG"
sed "s/GAME_TITLE/$TITLE/g; s/GAME_SLUG/$SLUG/g" templates/prd-v0.1.md > "docs/games/$SLUG/prd-v0.1.md"
printf '# %s changelog\n\n## v0.1 (unreleased)\n- Created from skeleton.\n' "$TITLE" > "docs/games/$SLUG/CHANGELOG.md"
# register in the launcher list
python3 - "$SLUG" "$TITLE" <<'PY'
import json, sys
slug, title = sys.argv[1], sys.argv[2]
p = 'games/index.json'
try: data = json.load(open(p))
except Exception: data = []
if not any(g['slug'] == slug for g in data):
    data.append({'slug': slug, 'title': title, 'status': 'v0.1 in progress', 'release': False})
json.dump(data, open(p, 'w'), indent=2); open(p, 'a').write('\n')
PY
echo "Created $DEST and docs/games/$SLUG. Next: fill docs/games/$SLUG/prd-v0.1.md, then run the Layer 1 prompt."
