#!/usr/bin/env bash
#
# worktree-rm.sh <change-id> [--delete-branch]
#
# Tear down a worktree created by worktree-new.sh. Removes the worktree dir (the
# symlinked .env / node_modules just vanish with it — the main tree is untouched).
# With --delete-branch, also deletes the branch, but ONLY if it is already merged
# into its base — never force-deletes unmerged work.
#
# Env overrides:
#   WT_HOME  — parent dir for worktrees (must match worktree-new.sh)
#
set -euo pipefail

CHANGE_ID="${1:?usage: worktree-rm.sh <change-id> [--delete-branch]}"
DELETE_BRANCH="${2:-}"
BRANCH="$CHANGE_ID"

MAIN_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
WT_HOME="${WT_HOME:-$(dirname "$MAIN_ROOT")/$(basename "$MAIN_ROOT")-worktrees}"
DEST="$WT_HOME/$CHANGE_ID"

if [ -e "$DEST" ]; then
  git -C "$MAIN_ROOT" worktree remove "$DEST" && echo "✓ removed worktree $DEST" \
    || { echo "✗ 'git worktree remove' refused (uncommitted changes?). Commit/stash inside the worktree, or use 'git worktree remove --force' by hand."; exit 1; }
else
  echo "… no worktree at $DEST (already gone?)"
fi

git -C "$MAIN_ROOT" worktree prune

if [ "$DELETE_BRANCH" = "--delete-branch" ]; then
  # -d refuses to delete an unmerged branch — exactly the guard we want.
  if git -C "$MAIN_ROOT" branch -d "$BRANCH" 2>/dev/null; then
    echo "✓ deleted merged branch $BRANCH"
  else
    echo "⚠ branch $BRANCH not deleted — not merged into its base (delete by hand with 'git branch -D $BRANCH' once you're sure)."
  fi
fi
