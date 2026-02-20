# Transfer Restrictions & Audit Trail — Design

## Changes Implemented

### 1. User info in nav bar

- **Files:** `top-nav.tsx`, `navigation.tsx`
- **What:** Shows logged-in user's name + Polish role badge left of logout button
- **Status:** Done

### 2. Role label: Majster → Manager

- **File:** `src/lib/auth/roles.ts`
- **What:** Changed `ROLE_LABELS.MANAGER.pl` from "Majster" to "Manager"
- **Status:** Done

### 3. Source register restricted to owned registers

- **Rule:** OWNER and MANAGER can only transfer FROM cash registers they own. ADMIN is unrestricted.
- **Files changed:**
  - `src/lib/auth/get-user-cash-registers.ts` — returns owned register IDs for OWNER+MANAGER (was MANAGER only)
  - `src/components/nav/navigation.tsx` — passes all registers + `userCashRegisterIds` (was filtering to AUXILIARY only)
  - `src/components/nav/top-nav.tsx` — renamed prop `managerCashRegisterId` → `userCashRegisterIds`
  - `src/components/dialogs/add-transfer-dialog.tsx` — same prop rename
  - `src/components/forms/transfer-form/transfer-form.tsx` — source select filtered by `ownedRegisterSet`, target select shows all registers
  - `src/lib/actions/transfers.ts` — server-side validation: non-ADMIN users rejected if `cashRegister` not in owned list
- **Status:** Done

### 4. "Dodane przez" column in transfer table

- **File:** `src/lib/tables/transfers.tsx`
- **What:** Added `createdByName` to `TransferRowT`, mapped from `doc.createdBy` via workers lookup, added "Dodane przez" column
- **Status:** Done

### 5. No negative saldo constraint

- **Rule:** Any transfer that deducts from a cash register is rejected if it would cause negative balance. Applies to all roles.
- **File:** `src/lib/actions/transfers.ts`
- **What:** Before creating transfer, checks `sumRegisterBalance >= amount` for non-deposit types that have a cashRegister. Returns error with current balance if insufficient.
- **Status:** Done

### 6. "Dodane przez" filter in transfer table

- **Rule:** Filter transfers by who created them.
- **Files changed:**
  - `src/lib/queries/transfers.ts` — added `createdBy` URL param to `buildTransferFilters`
  - `src/components/transfers/transfer-filters.tsx` — added "Dodane przez" filter select dropdown, accepts `users` prop
  - `src/components/transfers/transfer-data-table.tsx` — added `users` to `FilterConfigT`
  - `src/components/transfers/transfer-table-server.tsx` — added `users` to `FilterConfigT`
  - `src/lib/queries/dashboard.ts` — extracts `managementUsers` from reference data
  - `src/components/dashboard/manager-dashboard.tsx` — passes `managementUsers` to filter config
- **Status:** Done

### 7. Manager dashboard scoped to own transactions

- **Rule:** On the dashboard, managers see only their own transactions. On investment/user/cash register detail pages, managers see all transactions (needed for verification). ADMIN/OWNER see all transactions everywhere.
- **Files changed:**
  - `src/lib/queries/transfers.ts` — added `onlyOwnTransfers` to `UserContextT`, filters by `createdBy` when set
  - `src/lib/queries/dashboard.ts` — returns `currentUserId`
  - `src/components/dashboard/manager-dashboard.tsx` — passes `onlyOwnTransfers: !isAdminOrOwner` and real user ID
- **Status:** Done

### 8. Tests

- **Fixed:** Pre-existing `needsOtherCategory` test failure in `transfer-constants.test.ts` (added `EMPLOYEE_EXPENSE` to trueFor)
- **Added:** 4 new tests in `transfer-table.test.ts` for `createdByName` resolution in `mapTransferRow`
- **Status:** Done (221 tests passing)

## Changes Pending (Next Session)

### 9. Separate deposit dialog

- **Rule:** Split 3 deposit types (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`, `COMPANY_FUNDING`) into their own dialog. Remove these types from the main transfer dialog.
- **Rationale:** Deposits (adding money) are conceptually different from expenses/transfers (spending money). Separate UX flows reduce confusion.
- **Implementation approach:**
  - Create `AddDepositDialog` component (similar structure to `AddTransferDialog`)
  - Create `DepositForm` component with only deposit-relevant fields (no invoice, no worker, no target register)
  - Filter `TRANSFER_TYPES` in main transfer form to exclude deposit types
  - Add deposit dialog button to `TopNav` alongside existing transfer button
  - Reuse `createTransferAction` server action (deposit types go through same pipeline)
- **Status:** Not started

### 10. Additional tests for next session

- **`getUserCashRegisterIds`**: test that OWNER returns owned IDs (was previously returning `undefined`)
- **`createTransferAction` ownership check**: test rejection when non-ADMIN uses non-owned register
- **Negative saldo constraint**: test rejection when balance insufficient
- **`buildTransferFilters` with `onlyOwnTransfers`**: test that `createdBy` filter is applied
- **`buildTransferFilters` with `createdBy` URL param**: test that param is parsed correctly
- **Status:** Not started

## Summary of all files changed this session

| File                                                    | Change                                              |
| ------------------------------------------------------- | --------------------------------------------------- |
| `src/lib/auth/roles.ts`                                 | Majster → Manager                                   |
| `src/lib/auth/get-user-cash-registers.ts`               | OWNER+MANAGER return owned IDs                      |
| `src/lib/actions/transfers.ts`                          | Ownership check + negative saldo check              |
| `src/lib/queries/transfers.ts`                          | `createdBy` filter + `onlyOwnTransfers`             |
| `src/lib/queries/dashboard.ts`                          | `managementUsers` + `currentUserId`                 |
| `src/lib/tables/transfers.tsx`                          | `createdByName` field + column                      |
| `src/lib/constants/transfers.ts`                        | (no change — referenced only)                       |
| `src/components/nav/navigation.tsx`                     | Pass all registers + `userCashRegisterIds` + `user` |
| `src/components/nav/top-nav.tsx`                        | User info display + prop rename                     |
| `src/components/dialogs/add-transfer-dialog.tsx`        | Prop rename                                         |
| `src/components/forms/transfer-form/transfer-form.tsx`  | Source filtered by ownership                        |
| `src/components/transfers/transfer-filters.tsx`         | "Dodane przez" filter                               |
| `src/components/transfers/transfer-data-table.tsx`      | `users` in FilterConfigT                            |
| `src/components/transfers/transfer-table-server.tsx`    | `users` in FilterConfigT                            |
| `src/components/dashboard/manager-dashboard.tsx`        | Own transactions + filter users                     |
| `src/__tests__/transfer-constants.test.ts`              | Fix pre-existing failure                            |
| `src/__tests__/transfer-table.test.ts`                  | New test file (4 tests)                             |
| `vitest.config.ts`                                      | (no change — reverted)                              |
| `docs/plans/2026-02-20-transfer-restrictions-design.md` | This file                                           |
