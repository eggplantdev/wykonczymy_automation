#!/usr/bin/env bash
# Polls Vercel for a new deployment (compared to the one present when the
# script starts) and tracks its state until READY / ERROR / CANCELED.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID="$(jq -r .projectId .vercel/project.json)"
TEAM_ID="$(jq -r .orgId .vercel/project.json)"
API_PATH="/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=1"

sleep 5  # let git push reach Vercel before we snapshot

last_uid="$(vercel api --raw "$API_PATH" | jq -r '.deployments[0].uid')"
prev_state=""

# NOTE: do NOT name the read target UID — it's a read-only bash builtin, and with
# `set -e` the failed assignment would kill the watcher on the first iteration.
while true; do
  IFS=$'\t' read -r dep_uid STATE URL < <(
    vercel api --raw "$API_PATH" \
      | jq -r '.deployments[0] | "\(.uid)\t\(.state)\t\(.url)"'
  )
  if [ "$dep_uid" != "$last_uid" ]; then
    if [ "$STATE" != "$prev_state" ]; then
      echo "  $STATE  https://$URL"
      prev_state="$STATE"
    fi
    case "$STATE" in
      READY)    exit 0 ;;
      ERROR|CANCELED) exit 1 ;;
    esac
  fi
  sleep 10
done
