# Merge Settlement into Transfer Dialog — Implementation Plan

> **Status:** COMPLETED with additional UI polish beyond original scope.

**Goal:** Merge the settlement dialog into the transfer dialog so all expenses (including worker settlements) go through one form.

**Architecture:** The transfer form gained per-line-item categories (both `otherCategory` and `expenseCategory`), per-line-item notes, saldo display, and WORKER register access. The settlement form/action/schema were deleted. The register transfer form and deposit form allow WORKER registers.

**Tech Stack:** Zod 4, TanStack Form, Next.js server actions, Vitest

**Spec:** `docs/plans/2026-03-10-merge-settlement-into-transfer.md`

---

## Chunk 1: Schema + Action Changes — DONE

### Task 1: Add per-line-item category/note to bulk transfer schema — DONE

- [x] Added `category` and `expenseCategory` to `lineItemClientSchema` and `createBulkTransferSchema` line items
- [x] Removed top-level `otherCategory`, `otherDescription`, `expenseCategory` from bulk schemas
- [x] Added per-line validation for `OTHER` (category required) and `INVESTMENT_EXPENSE` (expenseCategory required)
- [x] Guard pattern `!('lineItems' in d)` prevents shared rules from firing on bulk schemas (Zod 4 strips omitted fields)
- [x] Tests updated in `transfer-schema.test.ts`

### Task 2: Update bulk transfer action to use per-line-item category — DONE

- [x] Action reads `item.category` → `otherCategory` and `item.expenseCategory` → `expenseCategory` per line item
- [x] Tests updated in `transfer-actions.test.ts`

### Task 3: Move getRegisterSaldo to transfers action — DONE

- [x] Moved from `settlements.ts` to `transfers.ts`

---

## Chunk 2: Transfer Form UI Changes — DONE

### Task 4: Add saldo display to transfer form — DONE

- [x] Added `useState` for saldo + loading state
- [x] Fetch saldo on source register change
- [x] Display saldo inline and in summary box before submit

### Task 5: Remove WORKER exclusion from registers — DONE

- [x] Transfer form: removed `excludeTypes={['WORKER']}`
- [x] Register transfer form: removed `excludeTypes={['WORKER']}`
- [x] Deposit form: removed `excludeTypes={['WORKER']}` — workers can receive deposits

### Task 6: Per-line-item category and expenseCategory in transfer form — DONE

- [x] `expenseCategory` moved from top-level to per-line-item
- [x] `category` (for OTHER type) is per-line-item
- [x] Both render inline via `renderItemInline` in `LineItemsField`
- [x] Default `expenseCategory` pre-selects first item from `referenceData.expenseCategories` ("Materiały budowlane")

---

## Chunk 3: Delete Settlement + Cleanup — DONE

### Task 7: Remove settlement dialog from navigation — DONE

- [x] Removed import and usage from `top-nav.tsx`

### Task 8: Delete settlement files — DONE

- [x] Deleted: `settlement-form.tsx`, `settlement-schema.ts`, `add-settlement-dialog.tsx`, `settlements.ts`
- [x] Deleted: `settlement-actions.test.ts`, `settlement-schema.test.ts`
- [x] Updated `bulk-transaction.test.ts` and `optimistic-form-store.test.ts`

### Task 9: Clean up unused constants — SKIPPED

- `needsOtherCategory` is still used in Payload hooks (`src/hooks/transfers/validate.ts`)

### Task 10: Final verification — DONE

- [x] All 484 tests pass
- [x] Typecheck passes

---

## Additional Changes (post-plan)

### Rename "Kategoria wydatku" → "Typ wydatku inwestycyjnego"

- [x] Added `EXPENSE_CATEGORY_LABEL` constant in `src/lib/constants/transfers.ts`
- [x] Used in: table header, `ExpenseCategoryField`, transfer form inline dropdown
- [x] Payload collection labels (`expense-categories.ts`, `transfers.ts`) kept as `{ en, pl }` objects

### Remove duplicate note field

- [x] Removed `note`/`otherDescription` — only `invoiceNote` remains (rendered as "Notatka")

### Transfer dialog layout overhaul

- [x] Dialog widened to `max-w-[min(90vw,900px)]`
- [x] Field order: **Type + Date** (side by side) → **Cash Register** → Target Register → Investment → Line Items
- [x] Line item row 1: **Number | Amount | Description | Category** (description and category same `flex-1` width)
- [x] Line item row 2: **Number spacer | Note | File input** (aligned with row 1, both `flex-1`)
- [x] Separator between line items (`border-t`)
- [x] Numbered items (manual `{index + 1}.` span)

### File input styling

- [x] Changed from `border-2 border-dashed` to `border border-input bg-background` (matches regular inputs)
- [x] Fixed height to `h-9` (matches input height)
- [x] Icon shrunk to `size-4`
- [x] Label changed to "FV - Przeciągnij lub kliknij"
