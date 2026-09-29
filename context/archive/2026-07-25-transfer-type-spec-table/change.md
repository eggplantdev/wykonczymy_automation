---
change_id: transfer-type-spec-table
title: One spec table for transfer types, membership arrays derived
status: archived
created: 2026-07-25
updated: 2026-07-26
archived_at: 2026-07-26T06:27:25Z
branch: konradantonik/ex-573-transfer-type-spec-table
worktree: .claude/worktrees/ex-573-spec-table
---

## Notes

Tracked as **EX-573**: invert the transfer-type axis into one `TRANSFER_TYPE_SPECS` table
(`src/lib/constants/transfers.ts`) with every membership export derived from it. The rationale lives
in that file's docblock. Landed before `netto-expense-type` Phase 1, whose trap it closed:
`canBeSettled` aliased `isExpensesTabType` by coincidence, and `INVESTMENT_EXPENSE_NET` is exactly
the type that splits them — forgetting the carve-out leaks netto into `totalSettled` → margin.

Deliberately **not** derived: `TRANSFERS_SUMMARY_TYPES` (order is a live sheet column layout — pinned
in `src/__tests__/transfer-constants.test.ts`) and the ordered UI arrays (order is load-bearing;
membership derived, order explicit).

## Audit findings (research, 2026-07-25 — verify before acting)

### Cancellation mechanics

`type = 'CANCELLATION'` is an audit stub with no money meaning; `cancelled = true` on the original is
the sole mechanism removing it from every figure (see `context/foundation/lessons.md`). Operational
facts still true on 2026-09-29: `cancelTransferAction` (`src/lib/actions/transfers.ts`) does its two
writes — flag the original, create the stub with `amount` copied verbatim — with **no transaction
wrapper**; and `ON DELETE SET NULL` on `cancelled_transaction_id` means hard-deleting an original
**orphans** its CANCELLATION.

### The SQL sign rule the table does not reach

The register-balance queries in `src/lib/db/sum-transfers.ts` carry the sign rule implicitly:
`CASE WHEN type IN (deposits) THEN amount ELSE -amount END`, keyed on `source_register_id`. Giving
`RABAT` or `LOSS` a source register would start debiting cash registers **with no edit to that file**.

> **Superseded (partly):** the deposit list is no longer seven raw literals — it is derived from
> `DEPOSIT_TYPES` (`depositTypesInList`). The implicit `ELSE -amount` still stands.

### Latent disagreements — dormant, zero bad rows found (2026-07-25)

- **CORRECTION sign**: `getAmountError` (`src/lib/utils/validation.ts`) _rejects_ `amount >= 0`,
  while `collections/transfers.ts`, `hooks/transfers/validate.ts` and **AGENTS.md** all say "may be
  negative". Code wins; the prose needs correcting. Still true 2026-09-29.
- **`needsOtherCategory` is server-only** — absent from `transferFieldRules`
  (`src/lib/schemas/transfer-validation.ts`), so it surfaces as a thrown hook error instead of an
  inline field error. Still true 2026-09-29.
- Not re-verified since 2026-07-25: `otherCategory` has three readings (shown / required / never
  gated in the edit form) and nothing clears it, so an edit can weld one onto a `LABOR_COST`;
  `expenseCategory` is required but never cleared, so dropping a correction's investment orphans it.
- `createInternalTransferSchema` is dead but for its own test. Still true 2026-09-29.
