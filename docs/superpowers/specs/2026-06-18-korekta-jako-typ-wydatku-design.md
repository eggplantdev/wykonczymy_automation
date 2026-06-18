# Design: Korekta as a typed investment expense (not a separate balance line)

Date: 2026-06-18
Status: approved (design); implementation pending

## Problem

A `CORRECTION` transfer ("korekta") is meant to adjust a specific investment-expense
type ("typ wydatku inwestycyjnego" = the `expenseCategory` relation, e.g. "Materiały
budowlane"). Today it cannot, and it is mishandled in three layers:

1. **Form drops the type.** The bulk expense form renders the "typ wydatku
   inwestycyjnego" dropdown for a correction (`line-items-field.tsx` →
   `showsExpenseCategory('CORRECTION', hasInvestment)`), the user selects a value,
   but the submit mapper (`expense-form.tsx:142`) only sends `expenseCategory` when
   `type === 'INVESTMENT_EXPENSE'`. For a correction it sends `undefined`, so
   `expense_category_id` persists as NULL. Proof: row #3210 shows "—".
2. **Edit form hides the type.** `edit-transfer-form.tsx:147` gates the field on
   `needsExpenseCategory(row.type)` (INVESTMENT_EXPENSE only), so a correction's type
   cannot be set/fixed via "edytuj transakcję" either.
3. **Financials would double-count.** Once a correction carries a type it folds into
   the per-type breakdown (`sum-transfers.ts:174-184` already includes CORRECTION),
   AND a separate "Korekty" line sums all corrections (`map-category-costs.ts:30-32`).
   Both feed "Bilans inwestora" → counted twice.
4. **Sheets misroute it.** A correction is in `SHEET_TRANSFER_TAB_TYPES`
   (`constants.ts:86`) → synced to the "Transfery" tab. `EXPENSES_SYNC` filters to
   INVESTMENT_EXPENSE only, so it never reaches the "Wydatki" tab.

## Target state (owner decision)

A correction stops being a separate entity ("baton"). It becomes a **negative,
typed line item of investment expenses**, attributed to one `expenseCategory`. It
**reduces** investor costs within that type — counted **once**, no separate "Korekty"
line, no double count. In the kosztorys sheet it appears on the **"Wydatki"** tab.

For ID 77: the ~31k currently in corrections stops being a separate line and instead
lowers the relevant expense types' costs.

## Scope — 5 code areas + data

1. **Create form** — `expense-form.tsx:142`: send `expenseCategory` for `CORRECTION`
   too (extract the line-item mapping into a pure, testable function).
2. **Edit form** — `edit-transfer-form.tsx:147`: show the type field for corrections
   (falls out of the `needsExpenseCategory` change below). Update path already
   persists `expenseCategory` (`updateTransferAction:282`, `updateTransferSchema`).
3. **Validation** — make the type (and investment) required for corrections:
   - `needsExpenseCategory` ⊇ `CORRECTION` (drives create requirement, edit-form
     display, and the hook check in one place).
   - `validateLineItemCategories` — require type on a CORRECTION line item.
   - `validateTransfer` hook — require `expenseCategory` for CORRECTION.
   - `requiresInvestment` ⊇ `CORRECTION`.
4. **Financials** — remove the "Korekty" line/button entirely. No sum of corrections
   is shown anywhere in the UI (not even as an informational, balance-neutral row) —
   corrections are visible only as typed negative line items within their expense type:
   - `map-category-costs.ts:30-32` — drop the separate "Korekty" field.
   - `financial-stats.tsx:17,55,67` — remove `CORRECTION_LABEL` and its filtering.
   - `sum-transfers.ts` — corrections already fold into `categoryCosts`; retire the
     now-unused `totalCorrections` display. Audit all consumers (raporty, print/export).
5. **Sheets** — route corrections to the "Wydatki" tab:
   - `sheets-sync.ts` — `EXPENSES_SYNC.typeWhere` → `{ in: ['INVESTMENT_EXPENSE','CORRECTION'] }`;
     `tabSyncForType('CORRECTION')` → `EXPENSES_SYNC`.
   - `constants.ts:86` — remove `CORRECTION` from `SHEET_TRANSFER_TAB_TYPES`.

Data: every existing correction must be backfilled with a type, and any correction with
no investment must get one — a correction without an investment is a data bug (owner
decision), not a valid case. Doable **in-app via "edytuj transakcję"** (once area 2 ships)
— no prod SQL. Enumerate the full set against fresh prod data, not the stale local snapshot.

## Non-obvious sheet effects

- `expenseRow` (`tab-rows.ts:43`) **skips a line with no type**. An uncategorized
  correction is silently omitted from "Wydatki" until backfilled. Negative amounts
  are fine (finite → not skipped).
- Existing correction rows already on the "Transfery" tab do not move automatically.
  After the routing change the reconciler treats them as orphans (removes from
  "Transfery") and adds them to "Wydatki" — but only when a **material re-sync is run
  per affected investment**. This is an explicit Phase 2 step.

## Rollout — 2 phases (no window of wrong balances)

Legacy corrections live today ONLY in the "Korekty" line. Removing it before backfill
would make them vanish from the balance.

- **Phase 1** — areas 1–3 (enable + require the type on corrections everywhere); the
  "Korekty" line STAYS. Deploy → backfill the 34 corrections in-app.
- **Phase 2** — areas 4–5 (remove the "Korekty" line + reroute sheets). Deploy → run
  a material re-sync per affected investment.

Balances stay correct throughout.

## Testing strategy (TDD, red→green)

Unit, on observable behavior, aligned to existing test files:

Phase 1

- Extracted line-item mapper: a CORRECTION line item carries `expenseCategory`.
- `validateTransfer` (`validate-hook.test.ts`): CORRECTION without type → throws;
  without investment → throws.
- `validateLineItemCategories`: CORRECTION line item without type → issue.

Phase 2

- `buildFinancialFields` (`map-category-costs.test.ts`): no "Korekty" line; a typed
  correction reduces its expense type exactly once (no double count).
- `deriveFinancials`: pure, asserted from a `byType` array.
- Sheet routing (`sheets-sync.test.ts`, `tab-rows.test.ts`, `transfer-constants.test.ts`):
  `tabSyncForType('CORRECTION')` → expenses; `isSheetTransferTabType('CORRECTION')` is
  false; `expenseRow` builds a row for a typed correction and skips an untyped one.

Not unit-tested (no cheap real signal, no E2E harness): the live Google Sheets write
and the end-to-end form submit. Manual/Playwright verification after deploy.

## Out of scope

- `RABAT` / `LOSS` financial treatment (unchanged).
- Building a Playwright/E2E harness.
- Automatic data migration of legacy corrections (done manually in-app).
