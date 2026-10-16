#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .vercel/project.json ]; then
  echo "watch-deploy: .vercel/project.json missing — run 'vercel link' first" >&2
  exit 1
fi

SHA="${DEPLOY_SHA:-$(git rev-parse HEAD)}"

PROJECT_ID="$(jq -r .projectId .vercel/project.json)"
TEAM_ID="$(jq -r .orgId .vercel/project.json)"
# limit=20: so a concurrent preview from another branch can't hide our commit's deployment.
API_PATH="/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=20"

# `vercel api` is beta and prints a banner to stderr every call — drop it so only
# JSON reaches jq.
fetch() { vercel api --raw "$API_PATH" 2>/dev/null; }

notify() {
  command -v osascript >/dev/null 2>&1 && \
    osascript -e "display notification \"$1\" with title \"Vercel deploy\" sound name \"Basso\"" >/dev/null 2>&1 || true
}

# The poll loop below drops stderr (2>/dev/null) and swallows errors (|| true) — but that also hides a
# 403. Without this probe every poll would come back empty and after ~3 min the script would wrongly
# blame the Git integration.
check_auth() {
  local probe
  probe="$(vercel api --raw "$API_PATH" 2>&1)" || true
  if printf '%s\n' "$probe" | grep -qiE 'not authorized|forbidden|\(40[13]\)|could not retrieve project'; then
    {
      echo "  🔒 vercel: not authorized for the team that owns this project"
      echo "          (orgId $TEAM_ID, projectId $PROJECT_ID)."
      echo "          The account the CLI is logged into can't see this project's team."
      echo "          Working across multiple Vercel teams/accounts? Point the CLI at the right one:"
      echo "            vercel login     # re-authenticate as the account that owns this project, or"
      echo "            vercel switch    # change the active team/scope"
      echo "          Then 'vercel whoami' should succeed and 'vercel ls' should list this project."
    } >&2
    return 1
  fi
}

if [ "${1:-}" = "--check-auth" ]; then
  check_auth
  exit $?
fi

check_auth || exit 1

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
      case "$STATE" in
        READY) icon="✅" ;;
        ERROR | CANCELED) icon="❌" ;;
        *) icon="⏳" ;;
      esac
      echo "  $icon vercel: $STATE  https://$URL"
      prev_state="$STATE"
    fi
    case "$STATE" in
      READY) exit 0 ;;
      ERROR | CANCELED)
        notify "❌ Deploy ${STATE} for ${SHA:0:7}"
        exit 1 ;;
    esac
  elif [ "$appeared" -eq 0 ] && [ "$attempts" -ge "$APPEAR_DEADLINE" ]; then
    echo "  ⚠️  vercel: no deployment for ${SHA:0:7} after ~3 min — is the Git integration connected?" >&2
    notify "⚠️ No deployment registered for ${SHA:0:7} after 3 min — check Git integration"
    exit 1
  fi

  sleep 10
done

echo "  ⏱️  vercel: watch-deploy gave up after ~20 min without a terminal state for ${SHA:0:7}" >&2
notify "⏱️ watch-deploy gave up after 20 min for ${SHA:0:7}"
exit 1
