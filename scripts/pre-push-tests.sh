#!/usr/bin/env bash
# Run under ONE `with-test-lock.sh` hold: each leg taking the lock itself would serialize them again.
set -uo pipefail
cd "$(dirname "$0")/.."

logs=$(mktemp -d)
unit_pid= typecheck_pid= integration_pid=
trap 'kill $unit_pid $typecheck_pid $integration_pid 2>/dev/null; rm -rf "$logs"' EXIT

echo "── pre-push: unit tests + typecheck + DB integration specs (in parallel) ──"
# More unit workers starve the single-worker integration leg and it nearly doubles.
node_modules/.bin/vitest run --silent --maxWorkers=5 --project node --project node-shared --project dom --project dom-shared > "$logs/unit" 2>&1 &
unit_pid=$!
node_modules/.bin/tsc --noEmit > "$logs/typecheck" 2>&1 &
typecheck_pid=$!
bash scripts/test-integration.sh > "$logs/integration" 2>&1 &
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
finish "DB integration specs" "$integration_pid" integration
[ -z "$failed" ] || { echo "✗ pre-push FAILED at: $failed" >&2; exit 1; }

echo "── pre-push: DB parity + golden master ──────────────────────────────"
pnpm test:parity || { echo "✗ pre-push FAILED at: DB parity + golden master" >&2; exit 1; }
