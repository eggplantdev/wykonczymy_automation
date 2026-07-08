# Settled (R+M) Expenses — Kosztorys/Sheets Billing Fix (FAZA 2) Implementation Plan

## Overview

`settled` expenses ("Materiały wliczone w robociznę" — R+M material absorbed by the
company) must **not** be billed to the client, but the Google Sheets materiały tab mirrored
them as ordinary rows with the amount in column E, so the client's `SUM(E:E)` / `SUMIF`
totals charged them. The app side (FAZA 1) is already correct; this plan fixes the Sheets
side only.

Two parts, deliberately split:

1. **Billing fix + marking (bill tab)** — on the `wydatki inwestycyjne (tylko do odczytu)`
   tab, a settled row writes `kwota = 0` (so every client formula auto-excludes it) and its
   type is suffixed `" rozliczone"` (e.g. `Materiały budowlane rozliczone`) to mark the
   0-cost line. Applies the moment a settled row is next synced; no reset needed.
2. **Visibility (separate tab)** — a new `rozliczone R+M (tylko do odczytu)` tab mirrors the
   settled expenses at their **real** amount with **plain** type, carrying the standard
   per-category summary (`RAZEM rozliczone` + per-category totals). A settled expense lands
   on **both** tabs; a non-settled one only on the bill tab.

## Why a separate tab (not a trailing column / extra column-block)

The app already syncs several independent tabs per investment (`wydatki inwestycyjne`,
`transfery`), each driven by a `SheetTabConfigT` + a sync spec. A settled tab is a **third
instance of the exact same pattern** — identical column shape and per-category SUMIF
summary — so the category breakdown comes out of the existing summary mechanism with **no
new formula logic**, and it can never disturb the existing tabs' frozen column layout (it is
a brand-new tab). The discarded alternatives (a trailing summed column on the bill tab, or a
second row-block in columns to the right) fought the one-table-per-tab assumptions baked into
`applyTabRowsBatch` / `readTabTransferIds` / summary positioning.

## Current State Analysis

- The expenses tab is column-mapped: `EXPENSES_TAB_CONFIG.header` = 7 cols (A–G); the
  per-category SUMIF summary starts at `summaryStartCol = cfg.header.length` (`sheets.ts`).
- `setupTab` clears + rebuilds a tab (header + summary + warning-only protection) and is the
  reset path. `applyTabRowsBatch` upserts/removes rows by the `id` column.
- `EXPENSES_SYNC` / `TRANSFERS_SYNC` (`sheets-sync.ts`) are the per-tab specs: a `where`,
  a `buildRow`, an optional `ensure` (auto-create). `tabSyncForType` routes a transaction to
  one tab by type. `applyMaterialSync` reconciles the tabs; `syncSingleTransferToSheet` /
  `syncBulkExpensesToSheet` are the per-transfer / bulk paths.
- **Phase 1 is done**: `expenseRow` writes settled bill-tab rows with `kwota = 0` and the
  `" rozliczone"` type suffix; `settledExpenseRow` (real amount, plain type) is added for the
  new tab. Verified: settled rows show 0 and are excluded from RAZEM/SUMIF (manual 1.6).
- **Stale-protection caveat** (out of scope, but blocks the rollout): sheets set up before
  the `warningOnly` switch carry a hard protection that blocks even the service account, so
  their syncs silently fail. Such a sheet must have its protection removed by the owner and
  be reset before any sync (incl. this fix) can land. See `change.md`.

## Desired End State

For an investment whose sheet the SA can write:

- **Bill tab** (`wydatki inwestycyjne (tylko do odczytu)`): settled rows show `kwota = 0`
  with type `"<kategoria> rozliczone"`; `RAZEM` / per-category SUMIF exclude them; non-settled
  rows unchanged. No rozliczone totals here.
- **`rozliczone R+M (tylko do odczytu)` tab**: every active settled expense, at its real
  (signed) amount, plain category type, with `RAZEM rozliczone` + per-category settled totals.
- Cancelling a settled expense removes it from **both** tabs; totals on both stay correct.
- Toggling settled→normal: the row leaves the rozliczone tab and its bill-tab row reverts to
  the real amount + plain type (and vice-versa).

## What We're NOT Doing

- **No app-side calculation changes** (FAZA 1 marża/bilans already correct).
- **No automatic sweep / bulk reset** of existing client sheets — owner-driven per sheet.
- **No trailing summed column** on the bill tab (the discarded design).
- **No per-row settled-amount column** on the bill tab — the amount lives on the new tab.
- **No fix to the stale hard-protection** in this change (tracked separately; it only blocks
  the rollout, not the code here).

## Phase 1: Bill-tab routing — settled → kwota 0 + type suffix "rozliczone" ✅ done

### Overview

Carry `settled` to the bill-tab row builder; a settled row writes `kwota = 0` and suffixes
its type `" rozliczone"`. Add `settledExpenseRow` (real amount, plain type) for the new tab.

### Changes Required (done):

- `src/lib/google/tab-rows.ts`: `TxDocT` gains `settled?: boolean`; `expenseRow` →
  `kwota = 0` + `"<cat> rozliczone"` when settled (dead `settledAmount` removed);
  new `settledExpenseRow` (settled-only, real amount, plain type).
- `src/lib/actions/sheets-sync.ts`: no change — `settled` is a default-returned column and the
  load paths cast `as unknown as TxDocT`, so it flows into the builders for free.

### Success Criteria:

#### Automated

- typecheck / lint pass; unit tests for `expenseRow` (settled → 0 + suffix; non-settled
  unchanged) and `settledExpenseRow` (real amount, plain type; non-settled → undefined).

#### Manual

- Reconcile a settled expense → bill tab shows `kwota 0` + `"… rozliczone"` type; RAZEM/SUMIF
  exclude it.

---

## Phase 2: Separate "rozliczone R+M" tab

### Overview

Add a third app-managed tab mirroring settled expenses at real amounts with the standard
per-category summary, and route/reconcile/cancel/toggle so a settled expense lives on both
the bill tab (0) and this tab (real), staying consistent.

### Changes Required:

#### 1. Tab config + summary keys

**File**: `src/lib/google/sheets.ts`
**Intent**: Describe the new tab with the same shape + per-category summary as the expenses tab.
**Contract**: Add `SETTLED_TAB_CONFIG` (tabName `rozliczone R+M (tylko do odczytu)`, same 7-col
header as `EXPENSES_TAB_CONFIG`, same `fieldMatchers`). Reuse the per-category summary builder
(labels `RAZEM rozliczone` + each expense category). Warning-only protection, same as the
other read-only tabs.

#### 2. Sync spec + routing

**File**: `src/lib/actions/sheets-sync.ts`
**Intent**: Feed only settled expenses to the new tab; keep all expenses (incl. settled at 0)
on the bill tab.
**Contract**: Add `SETTLED_SYNC` (`where` = type ∈ `EXPENSES_TAB_TYPES` AND `settled = true`,
`buildRow` = `settledExpenseRow`, `ensure` = auto-create the tab). Replace the single-tab
`tabSyncForType` with a helper returning the **list** of tabs a transaction belongs to: a
settled expense → `[EXPENSES_SYNC, SETTLED_SYNC]`, a non-settled expense → `[EXPENSES_SYNC]`,
a transfer type → `[TRANSFERS_SYNC]`. `loadAppRows` for `EXPENSES_SYNC` is unchanged (still
includes settled, rendered at 0 by `expenseRow`).

#### 3. Reconcile both tabs

**File**: `src/lib/actions/sheets-sync.ts`
**Intent**: `applyMaterialSync` keeps all three tabs correct, including orphan removal.
**Contract**: Build + apply a sync plan for `SETTLED_SYNC` alongside expenses + transfers.
Orphan removal naturally drops a row from the rozliczone tab once its transaction is no longer
settled/active.

#### 4. Per-transfer + bulk paths

**File**: `src/lib/actions/sheets-sync.ts`
**Intent**: Immediate single/bulk sync writes every tab a transaction belongs to.
**Contract**: `syncSingleTransferToSheet` / `syncBulkExpensesToSheet` iterate the tab list.
On a settled→normal **toggle**, the per-transfer path must also **remove** the row from the
rozliczone tab (it no longer belongs there) — and normal→settled must add it. Cancellation
(`removeTransferFromSheet` / CANCELLATION) removes from **all** tabs the transaction was on.

#### 5. Setup / reset

**File**: `src/lib/actions/sheets.ts` (+ wherever reset/`addUnlinkedSheetAction` stamps tabs)
**Intent**: Reset and link create the rozliczone tab too.
**Contract**: `setupTab(SETTLED_TAB_CONFIG, categories)` wherever the expenses/transfers tabs
are stamped; `SETTLED_SYNC.ensure` self-heals it for already-linked sheets.

### Success Criteria:

#### Automated

- typecheck / lint pass.
- Unit: `buildTabSummary` for `SETTLED_TAB_CONFIG` produces `RAZEM rozliczone` + per-category
  labels/SUMIFs; bill-tab + transfers summaries unchanged.
- Unit: the tab-list router returns both tabs for a settled expense, one for non-settled.

#### Manual

- Reset → `rozliczone R+M` tab appears; bill tab + transfers unchanged.
- Reconcile with a settled expense → bill tab row `kwota 0` + `"… rozliczone"`; rozliczone tab
  row at real amount + per-category totals correct; RAZEM rozliczone = Σ settled.
- Cancel the settled expense → removed from both tabs; both totals correct.
- Toggle settled→normal → leaves rozliczone tab; bill-tab row reverts to real amount + plain
  type; and back.
- Sync against a sheet without the rozliczone tab → `ensure` creates it; no error.

---

## Phase 3: Verification & regression guard

### Changes Required:

- Unit specs: `expenseRow` / `settledExpenseRow` routing (done, `tab-rows.test.ts`); summary
  builder for the rozliczone tab; the tab-list router.
- Manual script: reset + reconcile on a test investment (no Sheets mock harness).

### Success Criteria:

#### Automated

- `pnpm exec vitest run src/__tests__/lib/google/tab-rows.test.ts` and the sheets/sync specs pass.

#### Manual

- Phase 2 manual script re-run end to end, no regressions.

## Testing Strategy

- Unit: row builders (both), summary for the rozliczone config, the tab-list router.
- Manual (Sheets API path has no mock): reset → reconcile → cancel → toggle on a **test**
  investment; verify via the Sheets API (read column E + summary). Never a live client sheet.

## References

- App-side bucketing (mirror target): `src/lib/db/sum-transfers.ts`
- Sheets layer: `src/lib/google/sheets.ts`, `src/lib/google/tab-rows.ts`,
  `src/lib/actions/sheets-sync.ts`, `src/lib/actions/sheets.ts`
- Financial model: `docs/investment-financials-and-discount.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Bill-tab routing — settled → kwota 0 + type suffix "rozliczone"

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes (changed files): `pnpm lint`
- [x] 1.3 Unit: settled INVESTMENT_EXPENSE → kwota 0, type suffixed " rozliczone"
- [x] 1.4 Unit: settled CORRECTION (negative) → kwota 0, type suffixed
- [x] 1.5 Unit: non-settled unchanged (plain type, real amount); `settledExpenseRow` covered

#### Manual

- [x] 1.6 Reconcile settled → kwota 0; RAZEM/SUMIF exclude it
- [x] 1.7 Bill tab shows settled rows with type "… rozliczone" (confirm suffix on next reconcile)

### Phase 2: Separate "rozliczone R+M" tab

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck`
- [x] 2.2 Linting passes (changed files): `pnpm lint`
- [x] 2.3 Unit: `SETTLED_TAB_CONFIG` summary → `RAZEM rozliczone` + per-category SUMIFs; others unchanged
- [x] 2.4 Unit: tab-list router → both tabs for settled expense, one for non-settled

#### Manual

- [x] 2.5 Reset → `rozliczone R+M` tab appears; bill + transfers unchanged
- [x] 2.6 Reconcile settled → bill row 0 + suffix; rozliczone tab real amount + per-category totals
- [x] 2.7 Cancel settled → removed from both tabs; both totals correct
- [x] 2.8 Toggle settled→normal and back → row moves between tabs; bill row reverts/reapplies
- [x] 2.9 Sync against a sheet lacking the tab → `ensure` creates it; no error

### Phase 3: Verification & regression guard

#### Automated

- [x] 3.1 Specs pass: `pnpm exec vitest run src/__tests__/lib/google/tab-rows.test.ts` + sheets/sync specs
- [x] 3.3 Bridge regression test: bill-tab column-E sum == app client-billable total, settled
      excluded — mixed dataset through `expenseRow`, asserts settled→0, Σ(E) == Σ(non-settled),
      settled rows still appear suffixed. See `lessons.md` "An invariant enforced in two planes…".
      Proven red against pre-FAZA-2 behavior (columnESum 1729 vs expected 229), green after restore.
      `tab-rows.test.ts` describe "bill tab SUM(E:E) excludes settled — bridge invariant (3.3)".

#### Manual

- [x] 3.2 Phase 2 manual script re-run end to end, no regressions (owner-confirmed via screenshots 2026-06-29)
