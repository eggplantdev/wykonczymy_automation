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
  # Its three seeds are baked into the golden-master fixture, so a reset that skips one leaves the
  # fixture describing a dataset this container does not hold.
  pnpm db:reset:test
  printf '%s' "$FINGERPRINT" > "$STAMP"
else
  echo "→ test DB schema current — skipping re-import"
fi

# A DB-gated spec outside the `db` project only ever skips in the unit run.
MISNAMED="$(grep -rl 'skipIf(!ENV_READY)' src/__tests__ | grep -v '\.db\.test\.ts$' || true)"
[ -z "$MISNAMED" ] || { echo "✗ DB-gated specs must be named *.db.test.ts:" >&2; echo "$MISNAMED" >&2; exit 1; }

# --no-file-parallelism: these specs share ONE Postgres. Run in parallel they contend for connections
# (getPayload init timeouts) and race each other's fixtures. The two parity specs assert the whole
# dataset and run on their own in `pnpm test:parity`.
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node node_modules/vitest/vitest.mjs run --project db --project db-shared --no-file-parallelism \
  --exclude '**/investment-render-parity.db.test.ts' --exclude '**/financial-golden-master.db.test.ts'
