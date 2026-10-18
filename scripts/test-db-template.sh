#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

DB="wykonczymy-test"
TEMPLATE="wykonczymy-test-template"
MAX_AGE_DAYS=7
# Without leaving the dump out, every push would rebuild: pre-push rewrites the dump each time.
FINGERPRINT_INPUTS=(src/migrations/*.ts src/scripts/perf-seed-kosztorys.ts
  src/scripts/seed-deposit-planes.ts src/scripts/seed-materials-net.ts scripts/reset-sequences.sql
  src/collections/{kosztorys-items,kosztorys-sections,kosztorys-stages,stage-progress}.ts)

sql() { docker exec -i wykonczymy-test psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

ensure() {
  local force="${1:-}" fingerprint comment reason="" built
  fingerprint="$(cat "${FINGERPRINT_INPUTS[@]}" | git hash-object --stdin)"
  comment="$(sql -c "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '$TEMPLATE'")"
  built="$(sed -n 's/.*built=\([0-9]*\).*/\1/p' <<<"$comment")"

  if [ "$force" = "--force" ]; then reason="forced"
  elif [ -z "$comment" ]; then reason="missing"
  elif [ "$comment" = "${comment#fingerprint=$fingerprint }" ]; then reason="migrations, seeds or seeded collections changed"
  elif [ $(( $(date +%s) - ${built:-0} )) -gt $(( MAX_AGE_DAYS * 86400 )) ]; then reason="older than $MAX_AGE_DAYS days"
  fi

  if [ -z "$reason" ]; then
    echo "→ test DB template: reused (built $(date -r "$built" '+%Y-%m-%d %H:%M'))"
    return
  fi

  echo "→ test DB template: rebuilding — $reason"
  [ -s dumps/dump-latest.sql ] || pnpm db:dump
  # A clone whose CREATE failed leaves no database, and the import connects to it.
  [ -n "$(sql -c "SELECT 1 FROM pg_database WHERE datname = '$DB'")" ] || sql -c "CREATE DATABASE \"$DB\"" >/dev/null
  pnpm db:import:test
  # Its three seeds are baked into the golden-master fixture, so a reset that skips one leaves the
  # fixture describing a dataset this container does not hold.
  pnpm seed:kosztorys:test
  pnpm seed:deposits:test
  pnpm seed:materials-net:test

  # Without blocking connections, a warm E2E server reconnects between the terminate and the copy,
  # and CREATE DATABASE … TEMPLATE refuses a source with sessions.
  trap 'sql -c "ALTER DATABASE \"$DB\" WITH ALLOW_CONNECTIONS true" >/dev/null' EXIT
  sql -c "ALTER DATABASE \"$DB\" WITH ALLOW_CONNECTIONS false" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB' AND pid <> pg_backend_pid()" \
    -c "DROP DATABASE IF EXISTS \"$TEMPLATE\"" \
    -c "CREATE DATABASE \"$TEMPLATE\" TEMPLATE \"$DB\"" \
    -c "ALTER DATABASE \"$TEMPLATE\" WITH ALLOW_CONNECTIONS false" \
    -c "COMMENT ON DATABASE \"$TEMPLATE\" IS 'fingerprint=$fingerprint built=$(date +%s)'" >/dev/null
  echo "→ test DB template: rebuilt"
}

clone() {
  sql -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" -c "CREATE DATABASE \"$DB\" TEMPLATE \"$TEMPLATE\"" >/dev/null
  echo "→ test DB: cloned from template"
}

docker compose up -d --wait db-test >/dev/null
case "${1:-}" in
  ensure) ensure "${2:-}" ;;
  clone) clone ;;
  reset) ensure && clone ;;
  *) echo "usage: test-db-template.sh ensure [--force] | clone | reset" >&2; exit 64 ;;
esac
