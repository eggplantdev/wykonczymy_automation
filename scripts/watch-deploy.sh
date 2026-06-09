#!/usr/bin/env bash
# Tails the Vercel deployment for the EXACT commit being pushed and prints its
# state until READY / ERROR / CANCELED.
#
# Identifies the deployment by git commit SHA (meta.githubCommitSha), NOT by
# "newest deployment". The newest-deployment comparison is racy — the push can
# register its deploy on Vercel within seconds, so a baseline snapshot taken
# just after the push can capture the new deploy itself and then wait forever
# for a *different* one. It can also latch onto an unrelated branch's preview.
# A fixed SHA has neither problem.
#
# Started (backgrounded) from .husky/pre-push as:
#   DEPLOY_SHA="$(git rev-parse HEAD)" bash scripts/watch-deploy.sh &
# Reads projectId/orgId from .vercel/project.json, so it is project-agnostic.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .vercel/project.json ]; then
  echo "watch-deploy: .vercel/project.json missing — run 'vercel link' first" >&2
  exit 1
fi

# Commit this push deploys. Hook passes it via env; fall back to current HEAD.
SHA="${DEPLOY_SHA:-$(git rev-parse HEAD)}"

PROJECT_ID="$(jq -r .projectId .vercel/project.json)"
TEAM_ID="$(jq -r .orgId .vercel/project.json)"
# limit=20: scan recent deploys, not just the newest, so a concurrent preview
# from another branch can't hide our commit's deployment.
API_PATH="/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=20"

# `vercel api` is beta and prints a banner to stderr every call — drop it so only
# JSON reaches jq and the terminal isn't flooded across many polls.
fetch() { vercel api --raw "$API_PATH" 2>/dev/null; }

prev_state=""
appeared=0
attempts=0
APPEAR_DEADLINE=18 # ~3 min (18 × 10s) for the deploy to register, else likely no Git integration
MAX_ATTEMPTS=120   # ~20 min hard cap so this can never hang forever

while [ "$attempts" -lt "$MAX_ATTEMPTS" ]; do
  attempts=$((attempts + 1))

  # `|| true`: a transient `vercel api` failure yields empty input, jq errors,
  # and read hits EOF returning 1 — without this, `set -e` would kill the watcher.
  IFS=$'\t' read -r STATE URL < <(
    fetch | jq -r --arg sha "$SHA" \
      '[.deployments[] | select(.meta.githubCommitSha == $sha)][0] | "\(.state)\t\(.url)"'
  ) || true

  if [ -n "${STATE:-}" ] && [ "$STATE" != "null" ]; then
    appeared=1
    if [ "$STATE" != "$prev_state" ]; then
      echo "  vercel: $STATE  https://$URL"
      prev_state="$STATE"
    fi
    case "$STATE" in
      READY) exit 0 ;;
      ERROR | CANCELED) exit 1 ;;
    esac
  elif [ "$appeared" -eq 0 ] && [ "$attempts" -ge "$APPEAR_DEADLINE" ]; then
    echo "  vercel: no deployment for ${SHA:0:7} after ~3 min — is the Git integration connected?" >&2
    exit 1
  fi

  sleep 10
done

echo "  vercel: watch-deploy gave up after ~20 min without a terminal state for ${SHA:0:7}" >&2
exit 1
