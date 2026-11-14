#!/usr/bin/env bash
# A builder's own checkout, so parallel builders never touch each other's files (CLAUDE.md, "Keep it lean").
#   tools/worktree.sh new <name> [--with-changes]   create ../wt-<name> on a detached HEAD, print its path;
#                                                   --with-changes also copies uncommitted and untracked work
#   tools/worktree.sh land <name> <paths...>        merge the worktree's changes to those paths into this tree (a three-way
#                                                   merge against the commit the worktree started from, so two builders'
#                                                   edits to one file both land; a clash on the same lines stops with a conflict)
#   tools/worktree.sh land <name> --copy <paths...> the old way: copy the files over whole
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
    shift 2; copy=0; [[ "${1:-}" == "--copy" ]] && { copy=1; shift; }
    [[ $# -gt 0 ]] || { echo "land needs paths" >&2; exit 2; }
    for p in "$@"; do [[ -e "$WT/$p" ]] || { echo "missing in worktree: $p" >&2; exit 1; }; done
    if [[ $copy == 1 ]]; then
      for p in "$@"; do mkdir -p "$(dirname "$ROOT/$p")"; cp -R "$WT/$p" "$(dirname "$ROOT/$p")/"; echo "landed $p (copied)"; done
    else
      # each file merged three ways: the worktree's start (base), this tree (ours) and the builder's (theirs); binaries are copied
      base_rev=$(git -C "$WT" rev-parse HEAD); bad=0
      while IFS= read -r -d '' f; do
        rel=${f#"$WT/"}
        if ! git -C "$WT" cat-file -e "$base_rev:$rel" 2>/dev/null || [[ ! -e "$ROOT/$rel" ]]; then
          [[ -e "$ROOT/$rel" ]] && cmp -s "$f" "$ROOT/$rel" && continue
          mkdir -p "$(dirname "$ROOT/$rel")"; cp "$f" "$ROOT/$rel"; echo "landed $rel (new)"; continue
        fi
        git -C "$WT" diff --quiet "$base_rev" -- "$rel" && continue
        if grep -qI . "$f" || [[ ! -s "$f" ]]; then
          tmp=$(mktemp); git -C "$WT" show "$base_rev:$rel" > "$tmp"
          if git merge-file -L here -L start -L builder "$ROOT/$rel" "$tmp" "$f"; then echo "landed $rel (merged)"; else echo "CONFLICT in $rel: resolve the <<<<<<< markers" >&2; bad=1; fi
          rm -f "$tmp"
        else
          cp "$f" "$ROOT/$rel"; echo "landed $rel (binary, copied)"
        fi
      done < <(for p in "$@"; do if [[ -d "$WT/$p" ]]; then find "$WT/$p" -type f -print0; else printf '%s\0' "$WT/$p"; fi; done)
      exit $bad
    fi ;;
  drop)
    git worktree remove --force "$WT"
    echo "removed $WT" ;;
  *) sed -n 2,6p "$0" >&2; exit 2 ;;
esac
