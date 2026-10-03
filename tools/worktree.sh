#!/usr/bin/env bash
# A builder's own checkout, so parallel builders never touch each other's files (CLAUDE.md, "Keep it lean").
#   tools/worktree.sh new <name> [--with-changes]   create ../wt-<name> on a detached HEAD, print its path;
#                                                   --with-changes also copies uncommitted and untracked work
#   tools/worktree.sh land <name> <paths...>        copy those paths from the worktree back into this tree, list them
#   tools/worktree.sh drop <name>                   remove the worktree
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
cmd="${1:-}"; name="${2:-}"
[[ -n "$cmd" && "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { sed -n 2,6p "$0" >&2; exit 2; }
WT="$(dirname "$ROOT")/wt-$name"

case "$cmd" in
  new)
    [[ ! -e "$WT" ]] || { echo "already exists: $WT" >&2; exit 1; }
    git worktree add --detach "$WT" HEAD >/dev/null
    if [[ "${3:-}" == "--with-changes" ]]; then
      git diff HEAD --binary | git -C "$WT" apply --allow-empty --whitespace=nowarn
      git ls-files -o --exclude-standard -z | xargs -0 -r -I{} cp --parents {} "$WT"
    fi
    echo "$WT" ;;
  land)
    [[ -d "$WT" ]] || { echo "no worktree: $WT" >&2; exit 1; }
    shift 2; [[ $# -gt 0 ]] || { echo "land needs paths" >&2; exit 2; }
    for p in "$@"; do
      [[ -e "$WT/$p" ]] || { echo "missing in worktree: $p" >&2; exit 1; }
      mkdir -p "$(dirname "$ROOT/$p")"
      cp -R "$WT/$p" "$(dirname "$ROOT/$p")/"
      echo "landed $p"
    done ;;
  drop)
    git worktree remove --force "$WT"
    echo "removed $WT" ;;
  *) sed -n 2,6p "$0" >&2; exit 2 ;;
esac
