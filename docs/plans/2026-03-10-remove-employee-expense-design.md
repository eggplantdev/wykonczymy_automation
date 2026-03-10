# Remove EMPLOYEE_EXPENSE — Workers as Cash Registers

## Status: IMPLEMENTED ✓

Branch: `feat/workers-as-registers` (15 commits, all tests passing, migration verified)

## What Changed

Workers became `WORKER`-type cash registers. Two transfer types eliminated:

- `EMPLOYEE_EXPENSE` → `INVESTMENT_EXPENSE` or `OTHER` (with sourceRegister = worker's register)
- `ACCOUNT_FUNDING` → `REGISTER_TRANSFER` (to worker's register)

## Key Implementation Details

### Migration (two files — Postgres requires split)

1. `20260310_0_add_worker_register_type.ts` — adds `WORKER` to enum (must commit separately)
2. `20260310_workers_as_registers.ts` — creates registers, migrates 17 ACCOUNT_FUNDING + 1 EMPLOYEE_EXPENSE rows

### Auto-creation

`afterChange` hook on `users` collection creates a `WORKER` register when role becomes `EMPLOYEE`.

### UI Filtering

`CashRegisterField` gained `includeTypes` / `excludeTypes` props:

- Settlement dialog: `includeTypes={['WORKER']}` (pick worker register)
- Transfer/deposit forms: `excludeTypes={['WORKER']}` (hide worker registers)
- Register transfer: WORKER allowed in target (funding a worker)

### Settlement Form Redesign

- Picks a **worker register** instead of a worker user
- Investment mode → `INVESTMENT_EXPENSE` from worker register
- Category mode → `OTHER` from worker register
- Refund mode → `REGISTER_TRANSFER` from worker register → physical register
- Saldo = standard register balance (no special SQL)

### Removed Code

- `WORKER_SALDO_TYPES`, `needsWorker()`, `sumAllWorkerSaldos()`, `deriveWorkerBreakdown()`
- `getManagementEmployeeSaldo()` rewritten to use register balance
- Worker field hidden in transfers collection (kept for data, condition: `() => false`)

### Verification

- Feature DB on port 5434 (`db-feature` container), main DB on port 5433
- Pre-migration dump available for comparison
- 567 tests passing, typecheck clean
