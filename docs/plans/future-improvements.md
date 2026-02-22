# Future Improvements

## Error Handling Audit

Verify error handling across all layers:

### Server Actions (`src/lib/actions/`)

- `settlements.ts` — `try/catch` returns `getErrorMessage(err)`, but no granular handling (DB constraint violations, upload failures, etc.)
- `transfers.ts` — same pattern
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

## Performance: Covering Indexes for Transaction Aggregates

The computed-on-read functions (`fetchRegisterBalances`, `fetchInvestmentFinancials`, `fetchWorkerSaldos`) run `SUM()` queries over the `transactions` table on every cache miss. At current scale (~tens of rows) this is fine. As the table grows, add covering indexes to keep aggregation fast:

```sql
-- Register balance aggregation (sumAllRegisterBalances)
CREATE INDEX idx_txn_register_balance
  ON transactions (source_register_id, type, cancelled) INCLUDE (amount);

-- Also covers target register lookups for REGISTER_TRANSFER
CREATE INDEX idx_txn_target_register
  ON transactions (target_register_id, type, cancelled) INCLUDE (amount);

-- Investment financials aggregation (sumAllInvestmentFinancials)
CREATE INDEX idx_txn_investment_financials
  ON transactions (investment_id, type, cancelled) INCLUDE (amount);

-- Worker saldo aggregation (sumAllWorkerSaldos)
CREATE INDEX idx_txn_worker_saldo
  ON transactions (worker_id, type, cancelled) INCLUDE (amount);
```

### When to add

- When cold-cache query times for these functions exceed ~100ms in production
- Or when the `transactions` table exceeds ~50k rows
- Monitor via `[PERF]` logs in production

### Why not now

- Current data size makes full table scans negligible
- Indexes add write overhead on every `INSERT`/`UPDATE`/`DELETE`
- Premature optimization — add when measured, not speculated
