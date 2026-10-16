#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a   # export .env so child processes (payload/vitest) see PAYLOAD_SECRET etc.

docker compose up -d --wait db-test

STAMP="dumps/.test-db-schema-stamp"
FINGERPRINT="$(cat src/migrations/*.ts | git hash-object --stdin)"
SENTINEL_MISSING="$(docker exec -i wykonczymy-test psql -U "$POSTGRES_USER" -d wykonczymy-test -tAc \
  "SELECT to_regclass('public.kosztorys_snapshots') IS NULL" 2>/dev/null || echo t)"

if [ "$SENTINEL_MISSING" != "f" ] || [ "$(cat "$STAMP" 2>/dev/null || true)" != "$FINGERPRINT" ]; then
  echo "→ test DB empty or migrations changed — re-importing prod dump + migrating"
  [ -s dumps/dump-latest.sql ] || pnpm db:dump
  pnpm db:import:test
  DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec payload migrate
  # all three are baked into the golden-master fixture, so a reset that skips one leaves the fixture
  # describing a dataset this container does not hold.
  pnpm seed:kosztorys:test
  pnpm seed:deposits:test
  pnpm seed:materials-net:test
  printf '%s' "$FINGERPRINT" > "$STAMP"
else
  echo "→ test DB schema current — skipping re-import"
fi

FILES="$(grep -rl 'skipIf(!ENV_READY)' src/__tests__ \
  | grep -v 'investment-render-parity-db' \
  | grep -v 'financial-golden-master-db' | sort)"
[ -n "$FILES" ] || { echo "✗ no DB-gated integration specs found (marker moved?)" >&2; exit 1; }
echo "→ integration specs @ 5435:"; echo "$FILES" | sed 's/^/    /'

# --no-file-parallelism: these specs share ONE Postgres. Run in parallel they contend for connections
# (getPayload init timeouts) and race each other's fixtures
# shellcheck disable=SC2086  # word-split FILES into vitest args on purpose
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node node_modules/vitest/vitest.mjs run --no-file-parallelism $FILES
