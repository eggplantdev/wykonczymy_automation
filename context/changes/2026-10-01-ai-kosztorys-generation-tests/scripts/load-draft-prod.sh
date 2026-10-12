#!/usr/bin/env bash
# Loads a case's AI przedmiar draft into its PRODUCTION kosztorys — the one step no app action does, so
# it writes the production DB directly. Ask the user before every run.
#
# The loader runs from a throwaway worktree of origin/main: production runs main, and staging's Payload
# config reads columns production may not have yet. `push: false` in that config is what keeps Payload
# from touching the schema. The worktree is removed on exit, success or not.
#   TOKEN_FILE=… CASE=07-<slug> context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/load-draft-prod.sh
set -euo pipefail

: "${TOKEN_FILE:?TOKEN_FILE is required}" "${CASE:?CASE is required}"
REPO=$(git rev-parse --show-toplevel)
HERE="$REPO/context/changes/2026-10-01-ai-kosztorys-generation-tests"
CASE_DIR="$HERE/cases/$CASE"
INVESTMENT=$(node -p "require('$CASE_DIR/case.json').investmentId")
DRAFT="$CASE_DIR/$(node -p "require('$CASE_DIR/case.json').draft")"
PROD_URL=$(grep '^DB_POSTGRES_URL_PROD=' "$REPO/.env" | cut -d= -f2- | tr -d '"')
[ -n "$PROD_URL" ] || { echo "DB_POSTGRES_URL_PROD missing in .env" >&2; exit 1; }

git -C "$REPO" fetch -q origin main
git -C "$REPO" show origin/main:src/payload.config.ts | grep -q 'push: false' \
  || { echo "origin/main payload.config no longer has push: false — stop" >&2; exit 1; }

WT=$(mktemp -d)/wt-main
trap 'git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true' EXIT
git -C "$REPO" worktree add -q --detach "$WT" origin/main
ln -s "$REPO/node_modules" "$WT/node_modules"
sed '/assertLocalDb/d' "$WT/src/scripts/load-ai-draft.ts" > "$WT/src/scripts/load-ai-draft-prod.ts"

(cd "$WT" && DB_POSTGRES_URL="$PROD_URL" INV="$INVESTMENT" DRAFT="$DRAFT" \
  node --env-file="$REPO/.env" --conditions=react-server --import tsx src/scripts/load-ai-draft-prod.ts)

(cd "$REPO" && INVESTMENT="$INVESTMENT" node --import tsx "$HERE/scripts/touch-kosztorys-prod.ts")
