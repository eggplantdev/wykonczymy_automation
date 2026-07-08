---
id: kosztorys-settled-sheet-billing
title: Settled (R+M) expenses leak into the client's kosztorys bill — Sheets FAZA 2
status: archived
created: 2026-06-29
updated: 2026-07-08
archived_at: 2026-07-08T12:31:06Z
---

# Settled (R+M) expenses leak into the client's kosztorys bill — Sheets FAZA 2

The app side (FAZA 1) already excludes `settled` ("Materiały wliczone w robociznę")
expenses from marża/bilans. The Google Sheets layer was never taught about `settled`,
so settled expenses are mirrored to the materiały tab as ordinary billed rows (amount in
column E) and counted in the client's `SUM(E:E)` / `SUMIF` totals — the **opposite** of
intended. Bug confirmed on `main`.

This change implements FAZA 2 (the Sheets side), re-planned against current code (the old
`docs/plan-settled-expenses.md` FAZA 2 is stale — pre-2026-06-11 sheets refactor).

**Design (locked 2026-06-29):** two parts. (1) Bill tab `wydatki inwestycyjne (tylko do
odczytu)`: settled rows write `kwota = 0` and suffix the type `" rozliczone"` to mark the
0-cost line. (2) A new `rozliczone R+M (tylko do odczytu)` tab mirrors the settled expenses
at their real amount (plain type) with the standard per-category summary — a third instance
of the existing per-tab pattern, so the category breakdown is free and the bill tab's frozen
layout is untouched. A settled expense lands on both tabs; non-settled only on the bill tab.
Earlier trailing-column / extra-column-block designs were rejected (they fought the
one-table-per-tab assumptions).

**Rollout caveat (out of scope here, but blocks the fix landing):** sheets set up before the
`warningOnly` protection switch carry a HARD protected range that blocks even the service
account, so their syncs silently fail (`protectedAction` swallows the error). Such a sheet
must have its read-only-tab protections removed by the **owner** (the SA cannot) and be reset
before any sync — incl. this fix — can write. Worth auditing which live sheets are affected.

See: `context/changes/kosztorys-settled-sheet-billing/plan.md`,
`docs/plan-settled-expenses.md` (original, stale FAZA 2),
`docs/investment-financials-and-discount.md`.

## What shipped (2026-06-29)

**Phase 1** (bill tab): settled rows → `kwota = 0` + type suffix `" rozliczone"` (`expenseRow`,
`settledExpenseRow` in `src/lib/google/tab-rows.ts`). Owner-confirmed end-to-end via screenshots.

**Phase 2** (new tab): `SETTLED_TAB_CONFIG` `rozliczone R+M (tylko do odczytu)` mirrors settled
expenses at real amount with a `RAZEM rozliczone` per-category summary. Routing generalized from a
single-tab `tabSyncForType` to a list (`tabsForType`) — a settled expense lands on BOTH the bill and
rozliczone tabs; each tab's `buildRow` decides membership, so the cleanup paths (cancel/toggle/delete)
drop a row from every tab it could occupy. Reconcile/preview/per-transfer/bulk paths all iterate the
list. `setupTab`/`ensureTab` stamp the new tab in reset/link/add.

**Review + cleanup** (`/simplify` + `/code-review`, 10 agents): one **real correctness bug** found &
fixed — `removeTabRow` threw `MissingTabError` on un-migrated sheets (rozliczone/transfers tab absent),
now a no-op as its doc promised (+ regression test). Plus efficiency (lazy `ensureTab` summary keys),
reuse (`buildExpenseRow` core), and 3 structural proposals applied: `APP_MANAGED_TABS` registry +
`stampAllTabs` (new `src/lib/google/app-managed-tabs.ts`, kills the unrolled setup triple),
per-tab `MaterialSyncPreviewT` shape, and a concurrent (`Promise.all`) `applyMaterialSync` reconcile
(tests converted to an order-independent find router).

Gates: typecheck ✅, lint ✅, 670 tests ✅. **Not yet committed.**

## Follow-ups (deferred)

- **Regression test — the bridge** (plan 3.3): bill-tab column-E sum == app client-billable total with
  settled excluded; run `expenseRow` over a mixed dataset, prove red against pre-FAZA-2 behavior. This
  is the test that would have caught the original leak — see `lessons.md` "An invariant enforced in two
  planes…". Deferred per owner ("document now, add tests next").
- **Stale hard-protection rollout** (out of scope, tracked above): live client sheets set up before the
  `warningOnly` switch block even the SA → their syncs silently fail; owner must remove protection +
  reset per sheet before this fix lands there. Worth auditing which sheets are affected.
