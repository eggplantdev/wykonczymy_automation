# Bulk Transactions Design

## Problem

The transaction dialog (`AddTransferDialog`) only creates one transaction at a time. Users need to add many transactions of the same type (e.g., multiple investment expenses from the same cash register) without re-selecting shared fields each time.

## Solution

Convert the transfer form to an "always bulk" pattern — the form always uses a `lineItems` array (starts with 1 item). Shared fields (type, register, investment, worker, etc.) stay at the top. Per-item fields: description, amount, invoice file, invoice note.

This mirrors the existing settlement form pattern (`settlement-form.tsx`).

## Architecture

### Form Structure

```
Shared (top of form):
  - type (TransferTypeT)
  - expenseTarget radio (investment vs other, for EMPLOYEE_EXPENSE)
  - sourceRegister (conditional)
  - targetRegister (conditional, REGISTER_TRANSFER)
  - investment (conditional)
  - worker (conditional)
  - otherCategory + otherDescription (conditional)

Per-item (lineItems array):
  - description (string, required)
  - amount (string → number, required, > 0)
  - invoice file (via ref Map<number, File>, optional)
  - invoiceNote (string, optional)
```

### UI Pattern

- Line items rendered via TanStack Form `mode="array"` field
- Each item: description input + amount input + file input + invoice note + remove button (row layout)
- "Dodaj pozycję" button to append items
- Remove button disabled when only 1 item exists
- Running total displayed below line items (sum of all amounts)
- File refs stored in `Map<number, File>` indexed by line position (same as settlement form)

### Server Action: `createBulkTransferAction`

New function in `src/lib/actions/transfers.ts`:

1. Auth check (`requireAuth(MANAGEMENT_ROLES)`)
2. Validate via new `createBulkTransferSchema`
3. For non-deposit types: validate source register ownership + balance check (sum of ALL line item amounts)
4. Upload invoice files in parallel (`Promise.all`)
5. Create all transactions in parallel with `context: { skipBalanceRecalc: true }`
6. Single deferred recalc at end:
   - Register balance (if sourceRegister present)
   - Target register balance (if REGISTER_TRANSFER)
   - Investment financials (if investment present)
7. `revalidateCollections(['transfers', 'cashRegisters', 'investments'])`

### Schema Changes

**Client schema (`transferFormSchema`):**

- Flat amount/description fields replaced by `lineItems` array
- `invoiceNote` moves into line items
- Shared fields remain at top level
- Line item validation: each item needs description + amount > 0

**Server schema (`createBulkTransferSchema`):**

- New schema alongside existing `createTransferSchema` (which stays for single-transaction callers)
- Shared fields: type, paymentMethod, date, sourceRegister?, targetRegister?, investment?, worker?, otherCategory?, otherDescription?
- `lineItems`: array of `{ description, amount, invoiceNote? }`
- `superRefine` reuses existing `validateTransferFields` for shared field validation
- Additional: lineItems.length >= 1

### Files Modified

| File                                                    | Change                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/components/forms/transfer-form/transfer-form.tsx`  | Replace flat description/amount/invoice with lineItems array UI  |
| `src/components/forms/transfer-form/transfer-schema.ts` | Add bulk schemas (client + server), keep existing single schemas |
| `src/lib/actions/transfers.ts`                          | Add `createBulkTransferAction` function                          |
| `src/components/dialogs/add-transfer-dialog.tsx`        | No changes needed                                                |

### Key Decisions

- **Existing `createTransferAction` untouched** — other callers (e.g., `updateTransferNoteAction`) are unaffected
- **Balance check uses sum** — total of all line item amounts checked against register balance once
- **`skipBalanceRecalc: true`** — same pattern as settlements, single recalc at end
- **Recalc logic copied from settlement action** — uses raw SQL via `sumRegisterBalance`, `sumInvestmentCosts`, `sumInvestmentIncome`
- **FormFooter** remains unchanged — submit button text could show item count
