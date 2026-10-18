#!/usr/bin/env bash
# Baseline / after-measurement for test-suite-speed. Run from the repo root under the test lock:
#   with-test-lock bash context/changes/2026-10-18-test-suite-speed/measure.sh <label> > <log> 2>&1
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
LABEL="${1:-run}"
set -a; . ./.env; set +a

VITEST=(node node_modules/vitest/vitest.mjs run --no-file-parallelism
  --exclude '**/investment-render-parity.db.test.ts' --exclude '**/financial-golden-master.db.test.ts')

step() {
  local name="$1"; shift
  echo "=== $LABEL · $name · $(date +%H:%M:%S) · load $(sysctl -n vm.loadavg)"
  local out rc
  out="$(/usr/bin/time -p "$@" 2>&1)"; rc=$?
  grep -E '^(real|user|sys) |Test Files|^ +Tests |Duration|reused|rebuilt|re-importing|skipping re-import|FAIL|✗' <<<"$out" || true
  echo "=== exit $rc"
}

echo "commit $(git rev-parse --short HEAD) · $(date '+%Y-%m-%d %H:%M')"
for i in 1 2; do step "db:reset:test #$i" pnpm db:reset:test; done
for i in 1 2; do step "test:parity #$i" pnpm test:parity; done
for i in 1 2; do step "test:integration #$i" pnpm test:integration; done
for i in 1 2; do
  step "project db #$i" env DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" "${VITEST[@]}" --project db
  step "project db-shared #$i" env DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" "${VITEST[@]}" --project db-shared
done
