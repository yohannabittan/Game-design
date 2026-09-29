#!/usr/bin/env bash
# Build the shareable release channel (ADR-0016).
# Usage: tools/release.sh <version>      e.g. tools/release.sh v0.3
# Copies every game marked "release": true in games/index.json to release/games/<slug>/, marks the copy as the release
# channel, and writes release/index.html. Safe to run again: the release/games folder is rebuilt from the sources each time.
# A game whose docs/games/<slug>/CHANGELOG.md newest layer line says "Review: pending" is refused and left out (exit 2).
# release/ is generated: never hand-edit it.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:?version, e.g. v0.3}"
[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo "version may only use letters, digits, dot, dash, underscore: $VERSION" >&2; exit 1; }

python3 - "$VERSION" <<'PY'
import html, json, os, re, shutil, sys

version = sys.argv[1]
games = json.load(open('games/index.json'))
marked = [g for g in games if g.get('release')]
out = 'release'
gdir = os.path.join(out, 'games')

def newest_layer_line(slug):
    """The newest layer line of the highest version section. A changelog is newest-first or newest-last by habit, so
    the newest line is the first bullet when several sections run newest-first, else the last."""
    path = f'docs/games/{slug}/CHANGELOG.md'
    if not os.path.exists(path):
        return None, f'{path} is missing'
    sections, cur = [], None
    for line in open(path, encoding='utf-8').read().splitlines():
        m = re.match(r'^##\s+v?(\d+(?:\.\d+)*)', line)
        if m:
            cur = {'v': tuple(int(x) for x in m.group(1).split('.')), 'bullets': []}
            sections.append(cur)
        elif cur is not None and line.startswith('- '):
            cur['bullets'].append(line)
        elif cur is not None and cur['bullets'] and line.startswith(' ') and line.strip():
            cur['bullets'][-1] += ' ' + line.strip()
    sections = [s for s in sections if s['bullets']]
    if not sections:
        return None, f'{path} has no layer lines'
    top = max(sections, key=lambda s: s['v'])
    first = len(sections) > 1 and sections[0] is top
    return (top['bullets'][0] if first else top['bullets'][-1]), None

def tag(text, name, content):
    """Insert <meta name content> after the viewport meta, replacing an existing one."""
    text = re.sub(rf'[ \t]*<meta name="{name}"[^>]*>\n?', '', text)
    m = re.search(r'([ \t]*)<meta name="viewport"[^>]*>\n', text)
    assert m, 'index.html has no viewport meta'
    return text[:m.end()] + f'{m.group(1)}<meta name="{name}" content="{html.escape(content, quote=True)}">\n' + text[m.end():]

refused, built = [], []
os.makedirs(gdir, exist_ok=True)
for g in marked:
    slug = g['slug']
    src = os.path.join('games', slug)
    if not os.path.isdir(src):
        refused.append((slug, f'games/{slug} does not exist')); continue
    line, err = newest_layer_line(slug)
    if err or 'Review: pending' in line:
        refused.append((slug, err or 'newest layer line says "Review: pending": ' + line[:160] + ('...' if len(line) > 160 else ''))); continue
    dst = os.path.join(gdir, slug)
    if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst)

    p = os.path.join(dst, 'index.html'); t = open(p, encoding='utf-8').read()
    t = tag(tag(t, 'channel', 'release'), 'release-version', version)
    open(p, 'w', encoding='utf-8').write(t)

    p = os.path.join(dst, 'sw.js'); t = open(p, encoding='utf-8').read()
    t, n = re.subn(r"const CACHE_VERSION = '[^']*';", f"const CACHE_VERSION = '{slug}-release-{version}';", t)
    assert n == 1, f'{slug}: sw.js has no CACHE_VERSION line'
    # The worker's scope is its own folder, release/games/<slug>/, so every path must stay relative for the release cache to hold it.
    assert not re.search(r"'/[^/]", t.split('const ASSETS')[1].split('];')[0]), f'{slug}: sw.js ASSETS must be relative'
    open(p, 'w', encoding='utf-8').write(t)

    p = os.path.join(dst, 'manifest.webmanifest'); mf = json.load(open(p, encoding='utf-8'))
    mf['name'] = f"{version} {g.get('title') or mf.get('name', slug)}"
    json.dump(mf, open(p, 'w', encoding='utf-8'), indent=2); open(p, 'a').write('\n')
    built.append(g)

# The folder is script-owned: drop any copy that is no longer marked or was just refused.
for d in sorted(os.listdir(gdir)):
    if d not in [g['slug'] for g in built]:
        shutil.rmtree(os.path.join(gdir, d)); print(f'removed release/games/{d} (not built this run)')

cards = ''.join(f'''    <a class="card" href="games/{g['slug']}/">
      <img class="icon" src="games/{g['slug']}/icons/icon-192.png" alt="">
      <div><div class="title">{html.escape(g['title'])}</div></div>
      <div class="go">&rsaquo;</div>
    </a>
''' for g in built) or '    <div class="empty">No games in this release.</div>\n'
page = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Game Library {html.escape(version)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0f1115">
  <style>
    :root {{ color-scheme: dark; --bg: #0f1115; --card: #171b24; --line: #262c3a; --text: #e6e6e6; --muted: #9aa4b2; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: max(20px, env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); }}
    header {{ display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }}
    h1 {{ font-size: 24px; margin: 0; letter-spacing: 0.02em; }}
    .hint {{ color: var(--muted); font-size: 13px; }}
    a.card {{ display: grid; grid-template-columns: 56px 1fr auto; gap: 14px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-bottom: 12px; color: inherit; text-decoration: none; }}
    a.card:active {{ transform: scale(0.99); }}
    .icon {{ width: 56px; height: 56px; border-radius: 14px; background: #222; object-fit: cover; }}
    .title {{ font-size: 18px; font-weight: 700; }}
    .go {{ color: var(--muted); font-size: 22px; }}
    .foot {{ color: var(--muted); font-size: 13px; margin-top: 22px; line-height: 1.5; }}
    .empty {{ color: var(--muted); }}
  </style>
</head>
<body>
  <header><h1>Game Library</h1><span class="hint">{html.escape(version)}</span></header>
{cards}  <p class="foot">Play a game, then tap EXPORT on its menu, tap Copy and paste the text into your message. Nothing is sent anywhere unless you paste it. Use Share, then Add to Home Screen to keep a game; after one online launch it plays offline.</p>
</body>
</html>
'''
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page)
# The dev launcher looks for this to show a link to the release channel.
json.dump({'version': version, 'games': [g['slug'] for g in built]}, open(os.path.join(out, 'release.json'), 'w'), indent=2)
open(os.path.join(out, 'release.json'), 'a').write('\n')

print(f'release {version}: built {len(built)} game(s): ' + (', '.join(g['slug'] for g in built) or 'none'))
for slug, why in refused: print(f'REFUSED {slug}: {why}', file=sys.stderr)
if not marked: print('no game is marked "release": true in games/index.json', file=sys.stderr)
sys.exit(2 if refused else 0)
PY
