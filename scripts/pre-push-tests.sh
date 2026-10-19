#!/usr/bin/env bash
# Run under ONE `with-test-lock.sh` hold: each leg taking the lock itself would serialize them again.
set -uo pipefail
# Without its own process group per leg, killing a leg leaves its vitest and `docker exec psql` children
# writing to the test DB after the lock is released.
set -m
cd "$(dirname "$0")/.."

logs=$(mktemp -d)
unit_pid= typecheck_pid= integration_pid=
trap 'for pid in $unit_pid $typecheck_pid $integration_pid; do kill -- "-$pid" 2>/dev/null; done; rm -rf "$logs"' EXIT
trap 'exit 130' INT TERM

echo "── pre-push: unit tests + typecheck + DB integration specs, parity (in parallel) ──"
# More unit workers starve the single-worker integration leg and it nearly doubles.
node_modules/.bin/vitest run --silent --maxWorkers=5 --project 'node*' --project 'dom*' > "$logs/unit" 2>&1 &
unit_pid=$!
node_modules/.bin/tsc --noEmit > "$logs/typecheck" 2>&1 &
typecheck_pid=$!
# The unit leg never selects `*.db.test.ts`, so without the DB legs the destructive restore path never runs before a push.
# Parity follows integration in this leg: both need the test DB, and the unit leg outlasts them.
{ bash scripts/test-integration.sh && pnpm test:parity; } > "$logs/integration" 2>&1 &
integration_pid=$!

failed=
finish() {
  echo "── pre-push: $1 ──────────────────────────────"
  wait "$2" && status=0 || status=$?
  cat "$logs/$3"
  [ "$status" -eq 0 ] || failed="$failed${failed:+, }$1"
}
finish "unit tests" "$unit_pid" unit
finish "typecheck" "$typecheck_pid" typecheck
finish "DB integration specs + parity" "$integration_pid" integration
[ -z "$failed" ] || { echo "✗ pre-push FAILED at: $failed" >&2; exit 1; }
