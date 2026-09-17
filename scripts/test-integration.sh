#!/usr/bin/env bash
# DB-backed integration tests against the ISOLATED 5435 test DB — never the dev DB
# (5433), never Neon prod. These specs gate on `describe.skipIf(!ENV_READY)`, so the
# plain `pnpm vitest run` in pre-push skips every one of them for lack of a DB; this
# is the leg that actually wires a DB and exercises the wipe-and-reinsert restore path.
#
# Middle path on cost: the specs SELF-PROVISION their fixtures (each beforeAll creates
# its own investment), so they need a schema-current DB, not fresh prod CONTENT. We
# therefore re-import the prod dump only when it can matter — the migrations changed or
# the test DB is empty — and otherwise just migrate (idempotent) and run. A full psql
# restore on every push would copy rows no test ever reads.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a   # export .env so child processes (payload/vitest) see PAYLOAD_SECRET etc.

docker compose up -d --wait db-test

STAMP="dumps/.test-db-schema-stamp"   # under gitignored dumps/ — never committed
# One hash over all migration files: differs iff a migration is added/edited/removed.
FINGERPRINT="$(cat src/migrations/*.ts | git hash-object --stdin)"
# `f` = table present (schema applied); anything else (incl. psql error) = treat as empty.
SENTINEL_MISSING="$(docker exec -i wykonczymy-test psql -U "$POSTGRES_USER" -d wykonczymy-test -tAc \
  "SELECT to_regclass('public.kosztorys_snapshots') IS NULL" 2>/dev/null || echo t)"

if [ "$SENTINEL_MISSING" != "f" ] || [ "$(cat "$STAMP" 2>/dev/null || true)" != "$FINGERPRINT" ]; then
  echo "→ test DB empty or migrations changed — re-importing prod dump + migrating"
  [ -s dumps/dump-latest.sql ] || pnpm db:dump
  pnpm db:import:test
  DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec payload migrate
  # A re-import restores the prod dump, which since ~2026-09 carries kosztorysy (4130 pozycji) and
  # 27 wpłaty brutto of its own — so neither seed below still fills an empty plane. They are kept for
  # DETERMINISM: `seed:deposits:test` pins the brutto axis to fixed ids and fixed kwoty on two known
  # investments, and `seed:kosztorys:test` is the ~1000-row PERF fixture, which also gives inw. 7 the
  # kosztorys the deposits seed's two-target split rests on. `seed:materials-net:test` is the one
  # that still fills an empty plane (INVESTMENT_EXPENSE_NET, 0 rows in the dump) — and all three are
  # baked into the golden-master fixture, so a reset that skips one leaves the fixture describing a
  # dataset this container does not hold.
  pnpm seed:kosztorys:test
  pnpm seed:deposits:test
  pnpm seed:materials-net:test
  printf '%s' "$FINGERPRINT" > "$STAMP"
else
  echo "→ test DB schema current — skipping re-import"
fi

# Discover DB-gated specs by their shared marker (no rotting hardcoded list); parity
# keeps its own dev-DB leg (`pnpm test:parity`), so exclude it here.
#
# The golden master is excluded for a stronger reason than "it has its own leg": unlike
# every other spec here it does NOT self-provision — it asserts the WHOLE dataset against
# a committed fixture, fingerprinted over every transaction id. Its neighbours create and
# delete investments in this same DB; they clean up today, but one aborted run leaves rows
# behind and the golden master then reports "dataset changed — regenerate". Following that
# advice would rebaseline the net against contaminated data and destroy it. It runs where
# the dataset is a clean restore: `pnpm test:parity`.
FILES="$(grep -rl 'skipIf(!ENV_READY)' src/__tests__ \
  | grep -v 'investment-render-parity-db' \
  | grep -v 'financial-golden-master-db' | sort)"
[ -n "$FILES" ] || { echo "✗ no DB-gated integration specs found (marker moved?)" >&2; exit 1; }
echo "→ integration specs @ 5435:"; echo "$FILES" | sed 's/^/    /'

# --no-file-parallelism: these specs share ONE Postgres and mutate it (create/delete investments,
# snapshots, sections). Run in parallel they contend for connections (getPayload init timeouts) and
# race each other's fixtures; serial is the correct discipline for a shared-DB integration suite.
# shellcheck disable=SC2086  # word-split FILES into vitest args on purpose
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node node_modules/vitest/vitest.mjs run --no-file-parallelism $FILES
