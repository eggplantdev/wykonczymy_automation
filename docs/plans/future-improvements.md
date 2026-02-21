# Future Improvements

## Error Handling Audit

Verify error handling across all layers:

### Server Actions (`src/lib/actions/`)

- `settlements.ts` — `try/catch` returns `getErrorMessage(err)`, but no granular handling (DB constraint violations, upload failures, etc.)
- `transfers.ts` — same pattern; `recalculateBalancesAction` has no `try/catch` at all
- Are Zod validation errors surfaced clearly to the user or just generic "error"?
- What happens when `uploadInvoiceFile` fails mid-batch in settlements (partial uploads)?

### Queries (`src/lib/queries/`)

- `getUser` — catches errors and returns `null`, good
- `getUserSaldo`, `getWorkerPeriodBreakdown` — no `try/catch`; a SQL error crashes the page
- `findTransfersRaw`, `findUsersWithSaldos`, `findAllUsersWithSaldos` — no error handling; rely on Next.js `error.tsx` boundary
- `fetchReferenceData` — raw SQL, no `try/catch`
- `sumRegisterBalance`, `sumInvestmentCosts`, etc. — raw SQL, no guards against empty/malformed results

### Raw SQL (`src/lib/db/sum-transfers.ts`)

- All functions trust `result.rows[0]` exists — no guard for empty result sets
- `Number()` on `null`/`undefined` returns `0` silently via `COALESCE`, but if the query structure changes this assumption breaks

### UI Error Boundaries

- Verify `error.tsx` exists for routes that use server queries
- Check if `Suspense` fallbacks handle rejection (not just loading)

### Questions to Answer

- Should failed queries return a typed error or throw?
- Should partial failures in batch operations (settlements) roll back or continue?
- Do we need user-facing error messages beyond the generic toast?

## Toggle Active Status (Users, Investments, Cash Registers)

Currently the dashboard tables have a client-side visibility filter (ActiveFilterButton), but no way to actually change an entity's `active` field from the UI.

### What's needed

- A toggle action in each table row (users, investments, cash registers) to set `active: true/false`
- Server action per entity: `toggleUserActiveAction`, `toggleInvestmentActiveAction`, `toggleCashRegisterActiveAction`
- Role-gated (ADMIN/OWNER only, matching field-level access on the collection)

### Revalidation strategy

- Collection-level revalidation for list queries (small dataset, cheap to refetch)
- Entity-level tags (`entityTag('user', id)`) for detail pages only
- Toggle action revalidates the collection tag (e.g. `CACHE_TAGS.users`) — no need for full page revalidation

### UI considerations

- What control? Icon button in the row? Context menu? Inline switch?
- Confirmation dialog before deactivating? (deactivating a cash register or user has downstream effects)
- Optimistic update or wait for server response?
