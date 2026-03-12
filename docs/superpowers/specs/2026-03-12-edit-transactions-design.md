# Edit Transactions — Design Spec

## Overview

Allow editing of select fields on transactions via a new edit dialog triggered from the transfers table. Consolidates inline note editing into the same dialog. Primary use case: correcting mistakes (wrong date, wrong investment, wrong category) without needing to cancel + recreate.

## Editable Fields

| Field             | Type                              | Shown When                                             |
| ----------------- | --------------------------------- | ------------------------------------------------------ |
| `description`     | text                              | Always                                                 |
| `date`            | date                              | Always                                                 |
| `paymentMethod`   | select                            | Always                                                 |
| `investment`      | relationship (investments)        | `INVESTOR_DEPOSIT`, `INVESTMENT_EXPENSE`, `LABOR_COST` |
| `expenseCategory` | relationship (expense-categories) | `INVESTMENT_EXPENSE`                                   |
| `otherCategory`   | relationship (other-categories)   | Always (optional)                                      |
| `invoiceNote`     | textarea                          | Always                                                 |

## Locked Fields (cancel + recreate)

`amount`, `type`, `sourceRegister`, `targetRegister`, `worker` (legacy), `cancelled`, `cancelledTransaction`, `createdBy`, `invoice` (separate upload flow)

### Financial Impact Acknowledgement

- **Cash register balances**: unaffected. None of the editable fields participate in `sumRegisterBalance` or `sumAllRegisterBalances`.
- **`date`**: affects date-filtered financial reports (investment dashboards, filtered views). Editing a date moves the transaction between reporting periods. This is intentional — correcting a wrong date is the primary use case.
- **`investment`**: affects investment financial totals (`sumAllInvestmentFinancials`). Moving a transaction from Investment A to Investment B changes both investments' reported costs/income. This is intentional — correcting a mis-categorized expense is a valid use case.
- **`expenseCategory`**: affects per-category breakdowns within investment financials (`sumCategoryBreakdown`). Same reasoning as `investment`.

Cache revalidation is handled by the existing `recalcAfterChange` Payload hook, which already resolves old/new values for investments and registers. The server action only needs to pass `['transfers']` to `withAction` (standard pattern).

## Permissions

| Role          | Can Edit                                          |
| ------------- | ------------------------------------------------- |
| ADMIN / OWNER | Any transaction                                   |
| MANAGER       | Own transactions only (`createdBy === user.id`)   |
| EMPLOYEE      | No access (existing `isAdminOrOwner` blocks them) |

### Non-editable transactions

- Cancelled transactions (`cancelled === true`)
- CANCELLATION-type transactions

## UI Design

### Edit Button (actions column)

- Pencil icon button, placed before the existing cancel button
- **Hidden** for cancelled / CANCELLATION rows (same as cancel button)
- **Disabled + tooltip** when user lacks permission (e.g., MANAGER viewing another user's transaction). Tooltip: "Możesz edytować tylko swoje transakcje"
- **Active** when user has edit permission

### Edit Dialog

- Title: "Edytuj transakcję"
- Read-only context at top: amount + type (so user knows what they're editing)
- Editable fields pre-filled from current row data
- Conditional fields shown/hidden based on transaction type (same rules as creation)
- Buttons: "Anuluj" (cancel) / "Zapisz" (save)
- Uses `useState` for form fields (simple dialog — no line items, no file uploads, no keep-open mode). Server-side Zod validation via `updateTransferSchema`.

### Removed: Inline NoteCell Editing

- `NoteCell` becomes display-only (plain text)
- `updateTransferNoteAction` server action removed (from `src/lib/actions/transfers.ts`)
- `NoteCell` component simplified (in `src/components/transfers/` or `src/components/dialogs/note-dialog`)
- Note editing consolidated into the edit dialog

## Server Action

### `updateTransferAction(transferId, data)`

- `withAction()` wrapper (standard pattern)
- `requireAuth()` guard
- Permission check: ADMIN/OWNER any; MANAGER only own (`createdBy === user.id`). Use same `createdBy` resolution pattern as `cancelTransferAction` (handle both number and populated object).
- Rejects cancelled and CANCELLATION transactions
- Validates via `updateTransferSchema` (Zod) — only the 8 editable fields
- Passes all required fields to `payload.update()` (not just changed ones) to ensure `beforeValidate` hook has complete data for cross-field validation
- Sets `updatedBy` to current user ID
- Cache revalidation: passes `['transfers']` to `withAction` (standard pattern). Entity-level revalidation (investments, registers) handled automatically by existing `recalcAfterChange` hook on `payload.update()`

## Payload Collection Changes

Remove `access: { update: () => false }` from the 8 editable fields in `src/collections/transfers.ts`. Keep it on `amount`, `type`, `sourceRegister`, `targetRegister`, `worker` — Payload-level safety net preventing locked field changes even via direct API access.

### New Audit Field: `updatedBy`

Add `updatedBy` relationship field (to `users`) on the transfers collection:

- Read-only in admin UI, sidebar position
- Auto-set by `updateTransferAction` on every edit
- Provides audit trail parity with the cancel flow (who changed what)

### Data Flow: New fields in `TransferRowT`

- Add `createdById: number | null` — populated from raw doc's `created_by_id`. Required for UI edit button permission check (compare against current user ID).
- Add `otherCategoryId: number | null` — populated from raw doc's `other_category_id`. Required to pre-fill the `otherCategory` relationship field in the edit dialog. Follows same pattern as existing `expenseCategoryId`.

- Add `otherDescription: string` — populated from raw doc's `other_description`. Required to pre-fill the `otherDescription` textarea in the edit dialog for `OTHER`-type transactions.

All populated in `buildTransferRows` / `mapTransferRow`.

## Submit & Refresh

Uses `useTransition` + `router.refresh()` pattern (same as `CancelTransferButton`):

1. User submits edit dialog → button shows "Zapisywanie..." (pending state)
2. Server action executes
3. Success: toast, dialog closes, `router.refresh()` reloads server data
4. Error: toast with error message, dialog stays open for retry

This is simpler than fire-and-forget optimistic updates and appropriate for a modal dialog where the user is already waiting.

## What Stays Unchanged

- Balance calculation SQL (`sum-transfers.ts`)
- `recalcAfterChange` / `recalcAfterDelete` hooks
- `createTransferAction`, `createBulkTransferAction`, `cancelTransferAction`
- Invoice actions (`updateTransferInvoiceAction`, `removeTransferInvoiceAction`)
- Invoice upload UI (`InvoiceCell`)

## Process Note

Run `/simplify` after each major implementation step to review code quality and reuse.
