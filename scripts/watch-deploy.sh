#!/usr/bin/env bash
# Tails the Vercel deployment for the EXACT commit being pushed and prints its
# state until READY / ERROR / CANCELED.
#
# Identifies the deployment by git commit SHA (meta.githubCommitSha), NOT by
# "newest deployment". The newest-deployment comparison is racy — a git push
# registers its deploy on Vercel within seconds, so a baseline snapshot taken
# around push time can capture the new deploy itself and then wait forever for a
# *different* one (the symptom: polls endlessly, never reports, leaks watchers).
# It can also latch onto an unrelated branch's preview. A fixed SHA has neither
# problem.
#
# Started (backgrounded) from .husky/pre-push as:
#   ( DEPLOY_SHA="$(git rev-parse HEAD)" bash scripts/watch-deploy.sh & )
# Reads projectId/orgId from .vercel/project.json — project-agnostic, drop into
# any Vercel-linked repo unchanged.
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

# macOS desktop alert for backgrounded failures. The watcher runs detached from
# `git push`, so its exit code gates nothing — without a notification, a failed
# deploy goes silent the moment you switch windows. Guarded by `command -v` so a
# non-macOS box (CI, Linux) no-ops instead of erroring.
notify() {
  command -v osascript >/dev/null 2>&1 && \
    osascript -e "display notification \"$1\" with title \"Vercel deploy\" sound name \"Basso\"" >/dev/null 2>&1 || true
}

# Preflight auth probe — fail fast with the REAL reason instead of masking it.
# The trap this guards against: if you belong to several Vercel teams and the
# account the CLI is logged into isn't a member of the team that owns THIS
# project, the API answers HTTP 403 "Not authorized". The poll loop below drops
# stderr (2>/dev/null) and swallows errors (|| true) so a banner can't flood the
# terminal — but that also hides a 403. Without this probe every poll would come
# back empty and after ~3 min the script would wrongly blame the Git integration.
# One extra call up front turns a 3-min misdiagnosis into an instant, accurate one.
# Returns 1 (not exit) so the pre-push hook can reuse it as a FOREGROUND precheck
# via --check-auth before backgrounding the watcher.
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

# --check-auth: probe only, then exit. The pre-push hook calls this in the
# FOREGROUND before backgrounding the real watcher, so a dead local token shouts
# immediately, attached to your push — instead of 3 min later in a detached log.
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
