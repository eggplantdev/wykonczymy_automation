# Confirm before saving a wydatek inwestycyjny without an invoice — Implementation Plan

## Overview

Saving a wydatek inwestycyjny (brutto or netto) whose row has no faktura file now stops on a neutral
confirm dialog — „Zapisz bez faktury” / „Popraw”. It asks, never refuses: a purchase with no
document still happened and has to be bookable. Applies to the create form (incl. zgłoszenie
acceptance and „wliczone w robociznę”) and to „Edytuj transakcję”.

## Current State Analysis

- Nothing requires or warns about a missing faktura. The Payload admin hint on `invoiceNote`
  („Wymagane jeśli nie załączono faktury”, `src/collections/transfers.ts:249`) dates from the first
  commit and was never enforced; it stays out of scope.
- The ask-before-write mechanism exists only inside `useManagedForm`
  (`src/components/forms/hooks/use-managed-form.ts:49`, `:94-97`, `:137-142`, `:179-188`): a
  `confirmBeforeSubmit(values) → copy | null`, awaited as a Promise inside `onSubmit`, answered by a
  `ConfirmDialog` spread from `submitConfirm`. Its one user is `deposit-form.tsx:120`.
- Neither target form uses `useManagedForm`: `ExpenseForm` (`src/components/forms/expense-form/expense-form.tsx:211`)
  and `EditTransferForm` (`src/components/forms/edit-transfer-form/edit-transfer-form.tsx:69`) each
  call `useAppForm` directly with their own `onSubmit`.
- Create form: invoice files live outside the form, id-keyed in `useInvoiceIngest`; `onSubmit`
  already projects them with `positionalFiles(value.lineItems, getFiles())` (`expense-form.tsx:249`).
  On zgłoszenie acceptance the worker's pages are downloaded and re-uploaded as files
  (`use-expense-draft-acceptance.tsx:90-99`), so `getFiles()` is the complete picture there too —
  `receiptMediaIds` only links the worker's history, it never becomes the transfer's `invoice`
  (`lib/actions/transfers.ts:172`).
- Edit form: kept pages are `visibleInvoices` (`useInvoiceRemoval`, `edit-transfer-form.tsx:135`;
  removal is immediate, its own action), new pages are `files` (`useFilePickIngest`, `:60`). The type
  is fixed (`row.type`).
- `isInvestmentExpense` already exists, private, in `src/lib/constants/transfers.ts:579`.

## Desired End State

- Create form, type „Wydatek inwestycyjny” or „… netto”, ≥1 row with no file → on „Zapisz” a neutral
  dialog „Brak faktury” names the rows (description, or „Pozycja N” when empty) and the count
  („… (2 z 3)”). „Zapisz bez faktury” saves exactly as today; „Popraw” / Escape returns to the form
  with every value and file intact and nothing sent. Every row has a file → no dialog.
- Edit form, same types, no kept and no newly picked page → same dialog, copy „Ta transakcja nie ma
  załączonej faktury.” Any other type → never asks.
- Validation errors still win: an invalid form never reaches the dialog.
- `useManagedForm` / the deposit form behave exactly as before.

### Key Discoveries:

- `ConfirmDialog.onCancel` fires after `onConfirm` too (`src/components/ui/confirm-dialog.tsx:25-27`)
  — harmless with a Promise (the second resolve is a no-op), which is why the existing pattern works.
- Specs that save an investment expense with no file and will now meet the dialog:
  - `src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx:234` (`files: new Map()`)
  - `src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx:220` (`new Map()`)
  - `e2e/drivers/expenses.ts` `createInvestmentExpense` — used by 6 specs, never attaches a file
  - `e2e/invoice-ingest.spec.ts` „nieczytelny HEIC nie wchodzi do formularza (EX-460)” — saves the
    edit dialog after the pick was refused, i.e. with no faktura
- `e2e/investment-expense-netto.spec.ts:33` submits an invalid form (netto gate) — validation
  refuses first, so it is unaffected.
- Fixture for the edit form: `src/__tests__/fixtures/transfer-row.ts`.

## What We're NOT Doing

- No server-side rule, schema change or migration — this is a client confirm only.
- `invoiceNote` does not exempt a row (owner, 2026-10-11).
- Not changing the immediate „Usuń fakturę” removal confirm in the edit form.
- Not touching other expense types (`OTHER`, `PAYOUT`, …) or the Payload admin hint.
- No per-row visual marker in the line-items list — the dialog names the rows.

## Implementation Approach

Extract the awaited-answer state from `useManagedForm` into a small `useSubmitConfirm()` hook in
`forms/hooks/` (three consumers), keep `useManagedForm`'s public API unchanged on top of it, and call
`ask(copy)` from the two forms' `onSubmit` after their existing guards and before `submit()`. The
missing-invoice wording is a pure function so both forms share one copy and it is unit-testable.

## Critical Implementation Details

**Timing & lifecycle** — in `ExpenseForm.onSubmit` the ask goes AFTER the `isIngesting` /
`isSaveBlocked` guards (a row mid-ingest would otherwise read as „no file”) and BEFORE `submit()`
(which closes the dialog optimistically). In `EditTransferForm`, `isIngesting` is checked inside the
`action`, not before it, so ask only when `!isIngesting`: an Enter mid-ingest must still reach the
existing „Poczekaj na przetworzenie plików.” error instead of a „no faktura” dialog for files that are
still converting.

## Phase 1: Shared confirm hook and missing-invoice copy

### Overview

Lift the confirm mechanism out of `useManagedForm` and add the shared wording, with no visible change.

### Changes Required:

#### 1. `useSubmitConfirm` hook

**File**: `src/components/forms/hooks/use-submit-confirm.ts` (new)

**Intent**: Own the „ask, await the answer, close” state that `useManagedForm` holds today, so a
form not built on `useManagedForm` can raise the same dialog.

**Contract**: `useSubmitConfirm(): { ask(copy: SubmitConfirmCopyT): Promise<boolean>; dialogProps }`
where `dialogProps` is spreadable onto `ConfirmDialog` (`open`, `title`, `description`,
`confirmLabel`, `cancelLabel`, `variant`, `onConfirm`, `onCancel`). `SubmitConfirmCopyT` moves here
from `use-managed-form.ts` and gains optional `variant?: 'alert' | 'neutral'` (absent → `ConfirmDialog`'s
default `alert`, so the deposit confirm stays red).

#### 2. `useManagedForm` on top of it

**File**: `src/components/forms/hooks/use-managed-form.ts`

**Intent**: Replace the inline `asked` state with `useSubmitConfirm`; `confirmBeforeSubmit` and the
returned `submitConfirm` keep their exact shape so `deposit-form.tsx` is untouched (re-export
`SubmitConfirmCopyT` only if something still imports it from here — check with grep/tsc).

#### 3. Export the type predicate

**File**: `src/lib/constants/transfers.ts`

**Intent**: Export the existing `isInvestmentExpense` (`:579`) instead of re-deriving the pair.

#### 4. Missing-invoice wording

**File**: `src/lib/transfers/missing-invoice-confirm.ts` (new)

**Intent**: One source for the dialog copy, shared by both forms.

**Contract**: `missingInvoiceConfirm(rows: { description: string }[], hasInvoice: boolean[]): SubmitConfirmCopyT | null`
— `null` when every row has one. Title „Brak faktury”; confirm „Zapisz bez faktury”; cancel
„Popraw”; `variant: 'neutral'`. Description: one row total → „Ta pozycja nie ma załączonej
faktury.”; several → „Bez faktury: <names> (<missing> z <total>).”, a name being the trimmed
description or „Pozycja <index+1>”. The edit form passes one row and gets its own sentence
(„Ta transakcja nie ma załączonej faktury.”) — expose that as a second small export or a `kind`
parameter; implementer's choice, one file.

### Success Criteria:

#### Automated Verification:

- Copy unit spec passes: `pnpm exec vitest run src/__tests__/lib/transfers/missing-invoice-confirm.test.ts`
- `useManagedForm` spec still passes: `pnpm exec vitest run src/__tests__/components/forms/hooks/use-managed-form.test.tsx`
- New `useSubmitConfirm` spec passes (ask → confirm resolves `true`, cancel resolves `false`, dialog
  closed after either): `pnpm exec vitest run src/__tests__/components/forms/hooks/use-submit-confirm.test.tsx`

#### Manual Verification:

- „Nowa wpłata” on a brutto investment with a gotówka wpłata still raises the red „Ta wpłata nie
  policzy się w rozliczeniu” confirm, and „Popraw” keeps the form.

---

## Phase 2: Create form asks

### Overview

`ExpenseForm` raises the dialog for investment expenses with rows lacking a file; specs that saved
without one are updated.

### Changes Required:

#### 1. `ExpenseForm`

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: After the `isIngesting` / `isSaveBlocked` guards, if `isInvestmentExpense(type)` build
the copy from `value.lineItems` and the positional files already computed for the submit; if non-null,
`await ask(copy)` and `return false` on „Popraw”. Render `<ConfirmDialog {...dialogProps} />` inside
the form shell.

**Contract**: compute `positionalFiles(...)` once and reuse it for both the check and `submit()`.

#### 2. New DOM spec

**File**: `src/__tests__/components/forms/expense-form/expense-form-missing-invoice.test.tsx` (new)

**Intent**: Pin the behaviour at the form: no file → dialog with the row's name, „Popraw” → action
not called and values kept; „Zapisz bez faktury” → action called once; a row with a file → no
dialog, action called; type „Inny wydatek” with no file → no dialog. Mock setup mirrors
`expense-form-prefill.test.tsx` (`ingestFiles` stub, `createBulkTransferAction` mock).

#### 3. Existing DOM specs

**Files**: `src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx:234`,
`src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx:220`

**Intent**: These assert what the save carries (`receiptMediaIds` / skipped receipts), not the
faktura — click „Zapisz bez faktury” after „Zapisz” so they keep asserting that.

#### 4. E2E driver

**File**: `e2e/drivers/expenses.ts`

**Intent**: `createInvestmentExpense` never attaches a file, so after `submitExpenseForm` it confirms
„Zapisz bez faktury” before waiting for the dialog to close. `submitExpenseForm` stays a bare click
(the netto-gate spec relies on it being refused by validation).

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/components/forms/expense-form/expense-form-missing-invoice.test.tsx`
- Updated specs pass: `pnpm exec vitest run src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx`

#### Manual Verification:

- „Wydatek” → one row, no FV → „Zapisz” shows neutral „Brak faktury” naming the row; „Popraw” keeps
  every field; „Zapisz bez faktury” saves and closes.
- Three rows, two without FV → the dialog lists both names and „(2 z 3)”; a row with empty Opis
  reads „Pozycja N”.
- Every row with FV → saves with no dialog.
- „Wydatek inwestycyjny netto” and „Wliczone w robociznę” ticked → same dialog.
- „Nie zamykaj” + save without FV → dialog, then the form resets keeping the date.
- Accepting a zgłoszenie with photos → no dialog; after removing the only photo from a row → dialog.
- At 390px the dialog fits and both buttons are tappable.

---

## Phase 3: Edit form asks

### Overview

„Edytuj transakcję” on an investment expense left with no faktura asks the same.

### Changes Required:

#### 1. `EditTransferForm`

**File**: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`

**Intent**: Before `submit()`, when `isInvestmentExpense(row.type) && !isIngesting &&
visibleInvoices.length === 0 && files.length === 0`, ask with the single-transaction copy; „Popraw”
returns `false`. Render the second `ConfirmDialog` beside the existing `removalConfirm` one.
Accepted consequence (owner): editing any field of a legacy expense with no faktura asks every save.

#### 2. New DOM spec

**File**: `src/__tests__/components/forms/edit-transfer-form/edit-transfer-form-missing-invoice.test.tsx` (new)

**Intent**: Row from `src/__tests__/fixtures/transfer-row.ts`: investment expense with no invoices →
dialog, „Popraw” → `updateTransferAction` not called, confirm → called; same row with an invoice → no
dialog; an `OTHER` row with none → no dialog.

#### 3. E2E spec

**File**: `e2e/invoice-ingest.spec.ts` („nieczytelny HEIC … (EX-460)”)

**Intent**: The save after the refused pick is now a save with no faktura — confirm „Zapisz bez
faktury” before expecting the dialog hidden. The HEIC test (EX-732) picks a valid file and is
unaffected.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/components/forms/edit-transfer-form/edit-transfer-form-missing-invoice.test.tsx`

#### Manual Verification:

- Edit an investment expense that has a FV, change Opis, save → no dialog.
- Remove its only FV page („Usuń fakturę” confirm), then „Zapisz” → „Brak faktury” dialog;
  „Zapisz bez faktury” saves.
- Edit a legacy investment expense with no FV but pick a file → no dialog.
- Edit an „Inny wydatek” with no FV → no dialog.

---

## Testing Strategy

### Unit Tests:

- `missingInvoiceConfirm`: all rows with files → `null`; one row → single sentence; several →
  names + „(k z n)”; empty description → „Pozycja N”.
- `useSubmitConfirm`: resolves `true` / `false`, closes after either.

### Integration Tests:

- DOM specs per form (Phases 2–3). The risk is a UI gate between a valid form and the action — no
  server/DB boundary is crossed, so no new E2E spec; the existing E2E driver/spec are only kept green.

### Manual Testing Steps:

See each phase's Manual Verification.

## Performance Considerations

None — one array pass over the rows already projected for the submit.

## Migration Notes

None.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- E2E specs touched (`transfer-create`, `transfer-cancel`, `transfer-sum-tile`, `investment-expense-figures`,
  `investment-expense-netto`, `invoice-ingest`) — run only when the human asks.

## References

- Pattern: `src/components/forms/hooks/use-managed-form.ts:43-54`, `src/components/forms/deposit-form/deposit-form.tsx:120-131`
- Dialog: `src/components/ui/confirm-dialog.tsx`
- Change notes: `context/changes/2026-10-11-expense-missing-invoice-confirm/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared confirm hook and missing-invoice copy

#### Automated

- [x] 1.1 Copy unit spec passes
- [x] 1.2 `useManagedForm` spec still passes
- [x] 1.3 New `useSubmitConfirm` spec passes

### Phase 2: Create form asks

#### Automated

- [x] 2.1 New spec passes
- [x] 2.2 Updated specs pass

### Phase 3: Edit form asks

#### Automated

- [x] 3.1 New spec passes
