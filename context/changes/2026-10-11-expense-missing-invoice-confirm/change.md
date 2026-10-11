---
change_id: expense-missing-invoice-confirm
title: Confirm before saving a wydatek inwestycyjny without an invoice
status: implemented
created: 2026-10-11
updated: 2026-10-11
archived_at: null
branch: expense-missing-invoice-confirm
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/expense-missing-invoice-confirm
---

## Notes

Confirm dialog (neutral, ask-never-refuse) before saving a wydatek inwestycyjny (`INVESTMENT_EXPENSE` + `INVESTMENT_EXPENSE_NET`) whose row(s) have no invoice file.

Owner decisions (2026-10-11):

- Applies in the create form (`ExpenseForm`), including zgłoszenie acceptance and „wliczone w robociznę” (`settled`) rows.
- Applies in the edit-transfer form too: saving an investment expense left with no invoice pages (existing kept + newly picked) asks the same.
- `invoiceNote` does NOT exempt a row — a note alone still warns.
- Neutral variant, not red: the save is legitimate, the dialog only asks.

Design seed (from the research turn):

- Reuse the `confirmBeforeSubmit` pattern from `useManagedForm` (`src/components/forms/hooks/use-managed-form.ts`, used by `deposit-form.tsx`). Neither `ExpenseForm` nor `EditTransferForm` uses `useManagedForm`, so extract the awaited-answer state into a `useSubmitConfirm()` hook in `forms/hooks/` with three consumers (`useManagedForm`, `ExpenseForm`, `EditTransferForm`).
- Create form: ask inside `onSubmit` after the `isIngesting` / `isSaveBlocked` guards, before `submit()`; rows missing a file = `positionalFiles(value.lineItems, getFiles())` has no entry at that index.
- Edit form: missing = `visibleInvoices.length === 0 && files.length === 0`. Accepted consequence: editing an unrelated field on a legacy expense with no invoice asks on every save.
- Copy seed: „Brak faktury” / „2 z 3 pozycji nie ma załączonej faktury.” / „Zapisz bez faktury” / „Dodaj fakturę”.
- Test: DOM spec under `src/__tests__/components/forms/expense-form/` (no file → dialog, cancel → action not called, confirm → called; file → no dialog), plus the edit form.
