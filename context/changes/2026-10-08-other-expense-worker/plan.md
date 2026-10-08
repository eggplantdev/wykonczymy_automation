# „Inny wydatek” — opcjonalny pracownik Implementation Plan

## Overview

An `OTHER` expense („Inny wydatek”) can name an optional worker, the person who bought it. Management
then filters `Inny wydatek` + kategoria „narzędzia” + „Pracownik” and reads the total off the
existing „Suma” tile. Linear: EX-1027. Codebase map: `research.md`. Owner rulings: the „Follow-up
Research 2026-10-08” section there.

## Current State Analysis

- The read side is already done. `transactions.worker_id` exists (FK, index, and a
  `(worker_id, type)` index), so no migration is needed. `?worker=` filters on any type
  (`lib/queries/transfer-filters.ts:130-133`). The „Pracownik” column is type-agnostic. The worker
  page scope (`lib/queries/worker-transfers.ts:5-12`) already matches `worker = id`.
- The write side refuses the worker. `needsWorker` (PAYOUT/BONUS, `lib/constants/transfers.ts:561`)
  is used both to require the worker and to clear it. `hooks/transfers/validate.ts:175-177` sets
  `d.worker = null` on every other type.
- Every money reader of `worker_id` filters to `PAYOUT`/`BONUS`: „Pozostało do wypłaty”, settle
  payouts, the worker view, marża v1/v2. `OTHER` has no sheet tab. Naming a worker on an `OTHER` row
  therefore moves no figure.
- In „Kilka wydatków” the worker is **one per form** (`bulk-expense-schema.ts`, action
  `lib/actions/transfers.ts:144`). The owner wants it **per row** on `OTHER`.
- The edit form (`edit-transfer-form.tsx`) has no worker field, and `updateTransferSchema`
  (`lib/schemas/transfer.ts:51-65`) has no `worker`. The collection field has
  `access.update: () => false`. That lock binds only /admin and REST; `payload.update` from the
  action runs with the Local API default `overrideAccess: true`.
- The dashboard `/` passes no `workers` to its filters (`components/dashboard/manager-dashboard.tsx:72-80`),
  so the „Pracownik” filter does not render there. `/kasa/[id]` and `/inwestycje/[id]` already have
  it through `buildFilterConfig`.

## Desired End State

- In the expense form with type „Inny wydatek”, every row has an optional „Pracownik” picker, in
  single mode as well as in „Kilka wydatków”. Each booked row carries its own worker or none.
- The edit dialog of an `OTHER` transfer shows „Pracownik”. It can be set, changed or cleared. A
  `PAYOUT`/`BONUS` worker stays immutable.
- `/` shows the „Pracownik” filter. `?type=OTHER&otherCategory=9&worker=X` lists X's tool purchases
  and the „Suma” tile totals them.
- An `OTHER` row with worker X shows on `/pracownicy/X`. This needs no code: the scope already
  matches.
- „Pozostało do wypłaty”, marża and the sheet are unchanged for every investment and worker.

### Key Discoveries:

- `hooks/transfers/validate.ts:58` resolves `worker` with an originalDoc fallback, and
  `:115` already refuses a newly named trashed worker on any type. Only the clear at `:175-177` has
  to change.
- `map-line-item.ts` is the per-row type gate for line items (category, expenseCategory, netAmount).
  The per-row worker belongs there, next to them.
- `clear-fields-for-type.ts:30` `CARRIED_BY.worker` governs the **form-level** worker. That field
  stays PAYOUT/BONUS-only, so it stays `needsWorker`.
- Recovery snapshots parse line items with the client schema, so a new per-row key needs
  `.catch('')`. `netAmount` sets the precedent.

## What We're NOT Doing

- No per-worker breakdown table or ranking. The owner chose the filter plus „Suma” only (variant A).
- No worker on any other type: `INVESTMENT_EXPENSE`, `DEPOSIT` and the rest still drop it.
- No prefill from `worker_expense_drafts.worker_id` on draft acceptance. That belongs to EX-1004.
- No backfill of the 104 historical „narzędzia” rows. The manager does it by hand through the new
  edit field.
- No change to the `otherCategory` „Opcjonalnie” label vs the hook requiring it on `OTHER`
  (`validate.ts:167-169`). That is pre-existing drift and out of scope.
- No migration.

## Implementation Approach

Introduce the repo's usual "shows vs requires" split. `showsWorker` means allowed on the type
(PAYOUT, BONUS, OTHER). `needsWorker` means required (PAYOUT, BONUS) and is unchanged. The server
write path moves first (Phase 1), so every later UI phase has something to write into. The bulk form
carries the `OTHER` worker in the line item, not at form level. Two different fields with two
different gates is simpler than one field whose meaning flips with the type.

## Critical Implementation Details

- **Hook clear must use `showsWorker`.** If it does not, every UI change saves and the hook silently
  nulls the worker. This is the "success result hides a failed write" trap, so the Phase 1 tests
  assert the persisted `worker`, not the action result.
- **Bulk action precedence:** `worker: item.worker ?? parsed.data.worker`. On `OTHER` the form-level
  worker is never sent (not rendered, and cleared by `CARRIED_BY`). On `PAYOUT`/`BONUS` the line
  item never carries one (`mapLineItem` gate). The two sources therefore never collide, and the `??`
  is just the merge.
- **Edit action writes the worker only for `OTHER`.** Gate on `original.type` with a predicate for
  "editable worker" (`showsWorker && !needsWorker`). Drop the key otherwise, so no PAYOUT/BONUS
  worker ever changes through the edit, whatever the client sends. Send `null` to clear.

## Phase 1: Predicate and server write path

### Overview

Add `showsWorker`, stop the hook from clearing an `OTHER` worker, and accept a per-row worker in the
bulk create path.

### Changes Required:

#### 1. Predicate

**File**: `src/lib/constants/transfers.ts`
**Changes**: add `showsWorker = needsWorker(type) || type === 'OTHER'` next to `needsWorker`
(`:561`), using the same `isTransferType` guard. Keep `needsWorker` unchanged.

#### 2. Validate hook

**File**: `src/hooks/transfers/validate.ts`
**Changes**: change `:175` from `if (!needsWorker(type))` to `if (!showsWorker(type))`. The
"required" check at `:171` stays `needsWorker`.

#### 3. Collection field

**File**: `src/collections/transfers.ts:206-215`
**Changes**:

- `admin.condition` → `showsWorker`.
- `access.update` → allow only when the stored doc's type is `OTHER`, so the field states the same
  rule the action enforces.

#### 4. Bulk server schema and action

**File**: `src/components/forms/expense-form/bulk-expense-schema.ts`
**Changes**: in the server line-item schema of `createBulkExpenseSchema`, add
`worker: z.number().positive().optional()`.

**File**: `src/lib/actions/transfers.ts` (`createBulkTransferAction`, `:144`)
**Changes**: `worker: item.worker ?? parsed.data.worker`.

### Success Criteria:

#### Automated Verification:

- [ ] `transfer-constants.test.ts`: `showsWorker` is true for PAYOUT, BONUS and OTHER, and false for
  INVESTMENT_EXPENSE and DEPOSIT. `needsWorker(OTHER)` is false.
- [ ] `validate-hook.test.ts`: `OTHER` with a worker keeps it, `OTHER` without one passes, and
  `INVESTMENT_EXPENSE` with a worker gets it nulled. The PAYOUT requirement is unchanged.
- [ ] `bulk-transaction.test.ts` / `transfer-actions.test.ts`: a bulk `OTHER` with rows
  `[worker 5, no worker]` writes `worker: 5` and `worker: undefined` per row (assert on the
  `payload.create` data). A bulk `PAYOUT` still writes the form-level worker into every row.
- [ ] `pnpm typecheck`

#### Manual Verification:

- none for this phase. It is server-only and covered by Phase 2's UI check.

---

## Phase 2: Per-row worker in the expense form

### Overview

For type `OTHER`, each line item gets an optional „Pracownik” combobox. The submit sends it per row.

### Changes Required:

#### 1. Client schema and defaults

**File**: `src/components/forms/expense-form/bulk-expense-schema.ts`
**Changes**: add `worker: z.string().catch('')` to `lineItemClientSchema`. The `.catch` keeps old
recovery snapshots parseable.

**File**: `src/components/forms/expense-form/bulk-expense-form.ts`
**Changes**: add `worker: ''` to `makeLineItem`.

#### 2. Row gate

**File**: `src/components/forms/expense-form/map-line-item.ts`
**Changes**: `worker: type === 'OTHER' && item.worker ? Number(item.worker) : undefined`. Express the
condition through the "per-row worker" predicate from Phase 1 rather than a string literal, if one
reads cleanly (`showsWorker(type) && !needsWorker(type)`), and reuse it in Phase 3.

#### 3. Row field

**File**: `src/components/forms/form-fields/line-items-field.tsx`
**Changes**: when `transferType` is `OTHER`, render a per-row worker combobox in row 2, beside the
invoice field. Follow the `CategorySelect` pattern: `form.AppField` with name
`lineItems[${index}].worker`, `field.Combobox`, items from `referenceData.workers`, label
„Pracownik”, placeholder that reads as optional. Reuse the existing worker variant of
`EntityComboboxField` if it accepts a dynamic field name. Otherwise use the `CategorySelect` shape.
Don't create a new component for it.

### Success Criteria:

#### Automated Verification:

- [ ] `map-line-item.test.ts`: a row with `worker: '7'` maps to `7` for OTHER and to `undefined`
  for INVESTMENT_EXPENSE and PAYOUT. An empty worker maps to `undefined`.
- [ ] A recovery snapshot without `worker` still parses through `lineItemClientSchema` (the
  existing schema spec, or a new case in `bulk-transaction.test.ts`).
- [ ] `pnpm typecheck`

#### Manual Verification:

- [ ] „Inny wydatek”, „Kilka wydatków”: three rows with worker A, none and B. The booked rows show A,
  —, B in the „Pracownik” column.
- [ ] Switching the type from „Inny wydatek” to „Wydatek inwestycyjny” hides the row picker, and
  the booked row has no worker.

---

## Phase 3: Edit an `OTHER` transfer's worker

### Overview

The edit dialog of an `OTHER` transfer shows „Pracownik”. Set, change and clear all persist.

### Changes Required:

#### 1. Server schema

**File**: `src/lib/schemas/transfer.ts` (`updateTransferSchema`)
**Changes**: `worker: z.number().positive().nullable().optional()`. `null` clears, and an absent
key leaves the worker untouched.

#### 2. Action

**File**: `src/lib/actions/transfers.ts` (`updateTransferAction`)
**Changes**: destructure `worker` out of `parsed.data`. Spread `{ worker }` into the update only when
`worker !== undefined` and `original.type` passes the editable-worker predicate.

#### 3. Form

**File**: `src/lib/schemas/transfer-form.ts` (`editTransferFormSchema`)
**Changes**: add `worker: z.string()`.

**File**: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`
**Changes**:

- Default from `row.workerId`.
- Render `EntityComboboxField variant="worker"` with `referenceData.workers` only for an `OTHER`
  row, after the „Kategoria” select.
- On submit send `worker: value.worker ? Number(value.worker) : null` for OTHER, and omit the key
  for every other type.

### Success Criteria:

#### Automated Verification:

- [ ] `transfer-schema.test.ts`: `updateTransferSchema` accepts `worker: 3`, `worker: null` and an
  absent key.
- [ ] `transfer-actions.test.ts`: an update of an OTHER row with `worker: 3` passes `worker: 3` to
  `payload.update`, and `worker: null` passes `null`. An update of a PAYOUT row with `worker: 3`
  passes no `worker` key.
- [ ] `pnpm typecheck`

#### Manual Verification:

- [ ] Edit an existing „Inny wydatek / narzędzia” row and set worker X. The row appears on
  `/pracownicy/X` and under `?worker=X`. Clear it, and it disappears from both.
- [ ] The edit dialog of a „Wypłata” shows no worker picker.

---

## Phase 4: „Pracownik” filter on the dashboard

### Overview

`/` renders the worker filter, so the owner's query works from the main transactions list.

### Changes Required:

#### 1. Filter config

**File**: `src/components/dashboard/manager-dashboard.tsx` (`:72-80`)
**Changes**: add `workers: toOptions(referenceDataBase.workers)`, with `toOptions` from
`lib/utils/build-filter-config.ts`.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm typecheck`

#### Manual Verification:

- [ ] On `/`, Typ „Inny wydatek” + Kategoria „narzędzia” + Pracownik X lists only X's rows, and
  „Suma” equals their total.
- [ ] „Pozostało do wypłaty” for X on any investment is the same before and after X is named on an
  OTHER row.

---

## Testing Strategy

Each phase uses the cheapest layer that gives a real signal: the predicate, hook, schema, `mapLineItem`
and action specs in node, with Payload mocked the way the neighbouring specs mock it. The one
persisted-state risk, the hook nulling the worker, is covered in the hook spec by asserting the
returned `data.worker`. No E2E: this is a form field plus an existing filter, and the manual checks
cover the browser path. Run touched specs with `pnpm exec vitest run <file>`, not the full suite.

## Docs

- Put the `showsWorker`/`needsWorker` split into the transfer rules section of AGENTS.md only if
  implementation shows the split is non-obvious. The predicate names already state it, so the
  default is no doc change.
- When the change ships, archive the change folder per the doc lifecycle.

## References

- Research and owner rulings: `context/changes/2026-10-08-other-expense-worker/research.md`
- Linear: EX-1027 (In Progress)

## Progress

### Phase 1: Predicate and server write path

- [x] 1.1 `showsWorker` predicate — 936d4292c
- [x] 1.2 Validate hook clears the worker only when `!showsWorker` — 936d4292c
- [x] 1.3 Collection field condition + update access for `OTHER` — 936d4292c
- [x] 1.4 Bulk server schema per-row `worker` + action precedence — 936d4292c
- [x] 1.5 Specs: constants, validate hook, bulk action — 936d4292c

### Phase 2: Per-row worker in the expense form

- [x] 2.1 Client line-item schema + `makeLineItem` default — e411ea87a
- [x] 2.2 `mapLineItem` gate — e411ea87a
- [x] 2.3 Per-row „Pracownik” field in `LineItemsField` — e411ea87a
- [x] 2.4 Specs: `mapLineItem`, snapshot parse — e411ea87a

### Phase 3: Edit an `OTHER` transfer's worker

- [x] 3.1 `updateTransferSchema` worker
- [x] 3.2 `updateTransferAction` writes the worker only for `OTHER`
- [x] 3.3 Edit form field + submit
- [x] 3.4 Specs: schema, action

### Phase 4: „Pracownik” filter on the dashboard

- [ ] 4.1 Pass `workers` to the dashboard filter config

## Whole-tree Gate

- [ ] G.1 `pnpm typecheck` (needs the user's go — hook-gated)
