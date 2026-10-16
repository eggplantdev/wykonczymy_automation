#!/usr/bin/env bash
# Dumps prod into dumps/dump-latest.sql with a progress bar estimated from the previous dump's size.
set -euo pipefail

source .env
mkdir -p dumps

out=dumps/dump-latest.sql
tmp=dumps/.dump-in-progress.sql
expected=$(stat -f %z "$out" 2>/dev/null || echo 0)
start=$(date +%s)

trap 'rm -f "$tmp"' EXIT

docker exec -i "$DOCKER_CONTAINER" pg_dump --clean --no-owner --no-acl "$DB_POSTGRES_URL_PROD" > "$tmp" &
pid=$!

draw() {
  local size mb pct filled elapsed
  size=$(stat -f %z "$tmp" 2>/dev/null || echo 0)
  mb=$((size / 1048576))
  elapsed=$(($(date +%s) - start))
  if ((expected > 0)); then
    pct=$((size * 100 / expected))
    ((pct > 99)) && pct=99
    filled=$((pct * 30 / 100))
    printf '\r  pg_dump [%-30s] %3d%%  %d / ~%d MB  %ds ' \
      "$(printf '%*s' "$filled" '' | tr ' ' '#')" "$pct" "$mb" "$((expected / 1048576))" "$elapsed" >&2
  else
    printf '\r  pg_dump %d MB  %ds ' "$mb" "$elapsed" >&2
  fi
}

if [[ -t 2 ]]; then
  while kill -0 "$pid" 2>/dev/null; do
    draw
    sleep 0.5
  done
fi

wait "$pid"
[[ -t 2 ]] && printf '\r  pg_dump done: %d MB in %ds%-40s\n' "$(($(stat -f %z "$tmp") / 1048576))" "$(($(date +%s) - start))" '' >&2

mv "$tmp" "$out"
cp "$out" "dumps/dump-$(date +%Y-%m-%d_%H-%M).sql"
