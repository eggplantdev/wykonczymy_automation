# Pre-push Overlap Implementation Plan

## Overview

Run the pre-push unit leg, the DB integration leg and `tsc` concurrently under one hold of the
machine-wide test lock, then parity. First fix the spec that the extra load makes flaky.

## Current State Analysis

Measured 2026-10-18 on 8 cores (4P + 4E), each leg alone: unit 57.1 s, integration 38.0 s, parity
5.8 s, `tsc` 8.2 s (already hidden behind integration). Sequential ≈ 101 s before `db:dump`.

Overlapped (unit + integration + `tsc`, then parity):

| Unit workers | Total  | Integration leg | Result                            |
| ------------ | ------ | --------------- | --------------------------------- |
| default (7)  | 77.1 s | 71.7 s          | green                             |
| 5            | 71.4 s | 61.1 s          | green                             |
| 4            | 65.4 s | 60.1 s          | `notifications.db.test.ts` failed |

- `with-test-lock` lets a nested call inherit the parent's hold (`DEV_TEST_LOCK_HELD`), so one outer
  hold covers parallel legs; today each leg takes the lock on its own, so they cannot overlap.
- `notifications.db.test.ts` "counts leads created after the cursor…": `markSeen` stamps `seen_at`
  with Postgres `now()` (µs, VM clock); `storeLead` goes through Payload, whose `createdAt` is a JS
  `Date` (ms, host clock). A lead created within the same millisecond, or under host/VM skew, lands
  at or before the cursor — expected 2, got 1. Load makes it likely.

## Desired End State

- `.husky/pre-push` runs `scripts/pre-push-tests.sh` under one `with-test-lock` hold. The script runs
  unit (`--maxWorkers=5`), integration and `tsc` in parallel, prints each leg's log under its name,
  names every failed leg, then runs parity.
- The migration gate and `db:dump` stay outside the lock, unchanged.
- The leads spec puts its leads on the DB clock and passes under load.

## What We're NOT Doing

- Parity on its own clone (lever B) — ~4 s for another moving part.
- Parallel integration workers (lever C), `db:dump`, E2E.
- Any change to `src/lib/db/notifications.ts` — the same-millisecond gap is test-only in practice.

## Phase 1: Deterministic leads cursor spec

### Changes Required:

- `src/__tests__/lib/db/notifications.db.test.ts`: after storing the two leads, set their
  `created_at` to Postgres `now()` so cursor and leads share one clock.

### Success Criteria:

#### Automated Verification:

- The spec passes 20× in a row while the unit suite loads the machine.

## Phase 2: Parallel pre-push legs

### Changes Required:

- New `scripts/pre-push-tests.sh`: the three parallel legs, per-leg logs, failure verdict, parity.
- `.husky/pre-push`: replace the unit / integration / typecheck / parity legs with one
  `bash scripts/with-test-lock.sh bash scripts/pre-push-tests.sh`.
- Root `AGENTS.md` „Suites are serialized machine-wide": the pre-push test legs share one hold.

### Success Criteria:

#### Automated Verification:

- `bash -n` on both files.
- A forced failure in one leg exits non-zero and names that leg.
- `bash scripts/with-test-lock.sh bash scripts/pre-push-tests.sh` green 3×; times recorded.

## Whole-tree Gate

- `ALLOW_TESTS=1 pnpm run typecheck` — run by the script itself.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Deterministic leads cursor spec

#### Automated

- [x] 1.1 Leads spec passes 20× under load — d83b1dfdf

### Phase 2: Parallel pre-push legs

#### Automated

- [x] 2.1 `bash -n` on hook and script
- [x] 2.2 Forced failure names the leg
- [x] 2.3 Script green 3×, times recorded
