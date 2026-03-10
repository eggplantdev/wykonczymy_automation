# Merge Settlement Dialog into Transfer Dialog

## Status: PLANNED

## Problem

Two separate dialogs (transfer + settlement) create overlapping transfer types (`INVESTMENT_EXPENSE`, `OTHER`). The settlement dialog is a specialized workflow that constrains source to WORKER registers, but the underlying data model is identical. Maintaining two forms, two schemas, two actions doubles the surface area for no structural reason.

## Design

### Transfer form gains

1. **WORKER registers selectable as source** — remove `excludeTypes={['WORKER']}` from source register field
2. **Saldo display** — fetch and show register balance when any source register is selected (before/after summary)
3. **Per-line-item `category`** (from `other-categories`) — required when type = `OTHER`, optional for all other expense types (`PAYOUT`, `LABOR_COST`, `INVESTMENT_EXPENSE`)
4. **Per-line-item `note`** — optional on all line items

### Transfer types unchanged

`INVESTMENT_EXPENSE`, `LABOR_COST`, `PAYOUT`, `OTHER` — no additions, no removals.

### `INVESTMENT_EXPENSE` unchanged

Top-level `expenseCategory` (from `expense-categories` collection) stays as-is. This is a structural field, not per-line-item.

### Register transfer form

Remove `excludeTypes={['WORKER']}` from source register — allows WORKER → physical register transfers. This covers the settlement dialog's "Transfer do kasy" mode.

### Schema changes

**`lineItemClientSchema`** gains:

- `category: z.string().optional()`
- `note: z.string().optional()`

**`createBulkTransferSchema`** line item gains:

- `category: z.number().positive().optional()`
- `note: z.string().optional()`

**Validation:**

- When `type === 'OTHER'`: each line item's `category` is required
- Otherwise: `category` is optional

**Removed:** top-level `otherCategory` and `otherDescription` from both client and server schemas.

### Action changes

**`createBulkTransferAction`** — per-line-item data now includes `category` and `note`:

```
otherCategory: item.category,
otherDescription: item.note,
```

Instead of current shared values:

```
otherCategory: parsed.data.otherCategory,
otherDescription: parsed.data.otherDescription,
```

### Saldo fetch

Move `getRegisterSaldo()` from `settlements.ts` to `transfers.ts`. The transfer form calls it `onChange` of source register selection. Display pattern copied from settlement form (current saldo + total + saldo after).

### Deleted

| File                                                        | Reason                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/components/forms/settlement-form/settlement-form.tsx`  | Merged into transfer form                                                                              |
| `src/components/forms/settlement-form/settlement-schema.ts` | Merged into transfer schema                                                                            |
| `src/components/dialogs/add-settlement-dialog.tsx`          | No longer needed                                                                                       |
| `src/lib/actions/settlements.ts`                            | `createSettlementAction` replaced by `createBulkTransferAction`; `getRegisterSaldo` moves to transfers |
| `src/__tests__/settlement-actions.test.ts`                  | Rewritten as transfer action tests                                                                     |
| `src/__tests__/settlement-schema.test.ts`                   | Rewritten as transfer schema tests                                                                     |

### Navigation

Remove `AddSettlementDialog` from `top-nav.tsx`. The transfer dialog now handles all expense flows including worker settlements.

### What does NOT change

- Balance calculation logic
- Deposit dialog
- `INVESTMENT_EXPENSE` + `expenseCategory` structure
- `getManagementEmployeeSaldo()` — moves to transfers.ts, logic unchanged
- Transfer cancellation flow
- Register transfer dialog (except removing WORKER source filter)

## Migration notes

No DB migration needed — the `transactions` table already has `other_category_id` and `other_description` columns per row. Currently they're set identically across bulk line items; after this change they vary per row. Schema is already correct.
