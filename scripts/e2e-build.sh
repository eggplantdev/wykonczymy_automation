#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

DIST=.next-e2e
STAMP="$DIST/e2e-fingerprint"

fingerprint() {
  local paths
  paths=$(mktemp)
  git -c core.quotePath=false ls-files -co --exclude-standard -- . ':!e2e' ':!src/__tests__' ':!context' ':!*.md' ':!scripts' \
    ':!.husky' ':!playwright*.ts' | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done > "$paths"
  # `.env` is ignored by git, yet the build inlines its NEXT_PUBLIC_* values.
  { paste "$paths" <(git hash-object --stdin-paths < "$paths"); cat .env .env.local 2>/dev/null
    node -v; cat node_modules/.modules.yaml; } | git hash-object --stdin
  rm -f "$paths"
}

# `unstable_cache` persists here across builds and DB resets, so a kept build would serve figures
# from rows the reset removed.
rm -rf "$DIST/cache/fetch-cache"

before=$(fingerprint)
if [ -f "$DIST/BUILD_ID" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$before" ]; then
  echo "→ e2e build: reused (sources unchanged)"
  exit 0
fi

rm -f "$STAMP"
pnpm build
# An edit landing mid-build leaves no stamp, so the next run rebuilds instead of trusting it.
[ "$(fingerprint)" = "$before" ] && echo "$before" > "$STAMP"
echo "→ e2e build: rebuilt"
