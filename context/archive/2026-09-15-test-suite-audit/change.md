---
change_id: test-suite-audit
title: Audit the whole test suite for bulk and for validity
status: archived
created: 2026-09-15
updated: 2026-10-18
archived_at: 2026-10-18T11:11:38Z
branch: null
worktree: null
---

## Notes

audyt całego pakietu testów: redundancja/rozmiar kodu testowego (co da się pociachać, zdedupować, sparametryzować) + walidacja sensu każdego testu (martwe, tautologiczne, testujące implementację zamiast zachowania, duplikujące warstwę niżej/wyżej)

## Kept on purpose

Raised as redundant during the audit, and each is the only guard of what follows it. Check here
before deleting one again:

- `leads/notifications.db.test.ts` no cursor → epoch: the shell-badge spec compares against the same SQL, so it can't catch a missing `COALESCE`
- `leads/wpforms.test.ts` „emailless input": `normalizeLead`'s no-questions path without an email
- `api/webhooks/landing/route.test.ts` missing signature → 403: a route that skips the check when the header is absent
- `hooks/transfers/guard-delete.test.ts` „active investment": the hook's only negative control
- `hooks/transfers/validate-lock.test.ts` mixed patch: `isInvoiceOnlyPatch` against a smuggled field
- `hooks/transfers/delete-invoice-media.test.ts` shared page: that the hook calls the helper at all
- `lib/leads/store-lead.test.ts` „returns the existing sibling": the early return the DB case can't see
- `derive-financials-bucketing.test.ts` netto cases: the matrix uses total = netTotal, so it can't tell which is read
- `collections/users-delete-guard.test.ts` positive control: also tears down four reference tables
- `default-coeffs.test.ts`: the sheet's `=R−R*0,15` relation
- `item-ref.db.test.ts` restore: that restore keeps the numbers
- `lib/actions/transfers.test.ts` „manager books from any register", „does not sync the sheet directly", invoice actions, `deleteOrphanedMediaAction`, permission rows: no DB case covers them
- `equipment/cell-font-size.test.tsx`, `use-inline-rename.test.tsx` no-`stopEditing`, `data-table.test.tsx` header/body agreement, `preview-columns` rate-column leak, `plane-price-columns` source column

An edit racing a cancel is held off by the same row lock as two racing cancels, but only the cancel
race has a test (`transfers.db.test.ts` „cancels once…").
