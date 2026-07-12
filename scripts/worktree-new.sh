#!/usr/bin/env bash
#
# worktree-new.sh <change-id> [base-branch]
#
# Create (or repair) an isolated git worktree for a 10x change so a slice can be
# implemented on its own branch and later diffed/PR'd against its base. Produces a
# tree that runs out of the box: symlinks the gitignored essentials, regenerates
# Payload types, and self-tests before reporting success.
#
# node_modules is SYMLINKED to the main tree — never `pnpm install` in a fresh
# worktree, which on this arm64 mac can swap lightningcss to x64 and break the CSS
# build (see AGENTS.md / memory project_pnpm_remove_breaks_lightningcss_arch). The
# symlink reuses main's correct binary. The one case where symlinking is unsafe is a
# slice that changes package.json/pnpm-lock.yaml: then the worktree needs its OWN
# node_modules. Re-run this script after adding a dep — it detects the drift and
# falls back to `pnpm install --force` into a detached (non-symlinked) node_modules.
#
# Env overrides:
#   WT_HOME  — parent dir for worktrees (default: <repo-parent>/<repo-name>-worktrees)
#
set -euo pipefail

CHANGE_ID="${1:?usage: worktree-new.sh <change-id> [base-branch]}"
BASE="${2:-main}"
BRANCH="$CHANGE_ID"

MAIN_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
WT_HOME="${WT_HOME:-$(dirname "$MAIN_ROOT")/$(basename "$MAIN_ROOT")-worktrees}"
DEST="$WT_HOME/$CHANGE_ID"

command -v pnpm >/dev/null || { echo "✗ pnpm not found on PATH"; exit 1; }
[ -f "$MAIN_ROOT/.env" ] || { echo "✗ no .env in main tree ($MAIN_ROOT) — nothing to symlink"; exit 1; }
[ -d "$MAIN_ROOT/node_modules" ] || { echo "✗ no node_modules in main tree — run 'pnpm install' there first"; exit 1; }

# The exact native artifact whose absence breaks the Tailwind v4 CSS build on this
# arm64 mac (AGENTS.md / memory project_pnpm_remove_breaks_lightningcss_arch).
lightningcss_present() {
  compgen -G "$1/node_modules/.pnpm/lightningcss-darwin-arm64@*/node_modules/lightningcss-darwin-arm64/lightningcss.darwin-arm64.node" >/dev/null
}

restore_lightningcss() {
  # Copy the arm64 binary's .pnpm dir from main if an install dropped it.
  local src
  src=$(compgen -G "$MAIN_ROOT/node_modules/.pnpm/lightningcss-darwin-arm64@*" | head -1) || return 1
  cp -R "$src" "$DEST/node_modules/.pnpm/" && echo "  lightningcss: restored arm64 binary from main"
}

# Drift is judged on the WORKTREE's tree vs base (committed + uncommitted) — NOT on
# the main tree, whose unrelated uncommitted edits must not force an install here.
deps_differ_from_base() {
  ! git -C "$DEST" diff --quiet "$BASE" -- package.json pnpm-lock.yaml 2>/dev/null
}

link_modules() {
  # Symlink node_modules to main (fast, reuses main's correct arm64 binary).
  ln -sfn "$MAIN_ROOT/node_modules" "$DEST/node_modules"
  echo "  node_modules: symlinked → $MAIN_ROOT/node_modules"
}

own_modules() {
  # Slice changed deps → the worktree needs its own node_modules. Seed from main
  # (preserves the arm64 lightningcss binary a from-scratch install would drop),
  # then reconcile the new dep. Restore the binary if pnpm still dropped it.
  [ -L "$DEST/node_modules" ] && rm -f "$DEST/node_modules"
  [ -d "$DEST/node_modules" ] || cp -R "$MAIN_ROOT/node_modules" "$DEST/node_modules"
  ( cd "$DEST" && pnpm install )
  lightningcss_present "$DEST" || restore_lightningcss
  echo "  node_modules: own (seeded from main + pnpm install) — deps differ from $BASE"
}

if [ -e "$DEST" ]; then
  echo "… worktree $DEST already exists — repairing (ensure mode)"
  ln -sfn "$MAIN_ROOT/.env" "$DEST/.env"
  [ -e "$DEST/node_modules" ] || link_modules
  if deps_differ_from_base; then
    [ -L "$DEST/node_modules" ] && own_modules || echo "  node_modules: own (unchanged)"
  elif [ ! -e "$DEST/node_modules" ]; then
    link_modules
  fi
else
  mkdir -p "$WT_HOME"
  if git -C "$MAIN_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "… branch $BRANCH exists — checking it out into a worktree"
    git -C "$MAIN_ROOT" worktree add "$DEST" "$BRANCH"
  else
    echo "… creating branch $BRANCH off $BASE"
    git -C "$MAIN_ROOT" worktree add "$DEST" -b "$BRANCH" "$BASE"
  fi
  ln -sfn "$MAIN_ROOT/.env" "$DEST/.env"
  if deps_differ_from_base; then own_modules; else link_modules; fi
fi

# Regenerate the gitignored Payload types against THIS branch's schema.
( cd "$DEST" && pnpm generate:types >/dev/null )
echo "  payload-types: regenerated"

# Self-test: prove the tree is actually runnable before claiming success.
lightningcss_present "$DEST" \
  || { echo "✗ lightningcss arm64 binary missing in worktree — CSS build would break. Aborting."; exit 1; }
if ( cd "$DEST" && pnpm typecheck >/dev/null 2>&1 ); then
  echo "  self-test: typecheck OK"
else
  echo "  self-test: ⚠ typecheck failed — worktree is set up but the branch does not yet typecheck (expected mid-implementation)"
fi

echo "✓ worktree ready"
echo "    path:   $DEST"
echo "    branch: $BRANCH (off $BASE)"
echo "    cd $DEST"
echo "  Note: manual checks / E2E share the single 5435 test DB — run only one verification at a time (the manual-check lock enforces this)."
