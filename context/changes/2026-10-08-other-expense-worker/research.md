---
date: 2026-10-08T10:55:08+02:00
researcher: Claude (Opus 5.5)
git_commit: 78752fbbd7f301efc268ac5b8641d6c545e2c166
branch: staging
repository: wykonczymy
topic: "Optional worker on an OTHER expense (Inny wydatek) — per-worker control of tool purchases"
tags: [research, codebase, transfers, other-expense, worker, filters, worker-page, expense-form]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Added owner decisions on open questions 1-4"
---

# Research: Optional worker on an OTHER expense

**Date**: 2026-10-08T10:55:08+02:00
**Git Commit**: 78752fbb
**Branch**: staging
**Repository**: wykonczymy
**Linear**: EX-1027 (related: EX-1004)

## Research Question

„Inny wydatek” is used for company purchases such as tools. Management wants control over them:
filter transactions of type `OTHER`, kategoria „narzędzia”, and see how much of that is attributed to
worker X or Y. Request: optionally attach a worker (and/or kasa) to an `OTHER` expense.

## Summary

- **The read side is already built.** The transactions list filters by `type`, `otherCategory` and
  `worker`, shows a filtered-sum tile, and has type-agnostic „Pracownik” and „Kategoria” columns.
  `?type=OTHER&otherCategory=9&worker=X` returns the right rows and total the moment `worker_id` is set
  on `OTHER` rows. One gap: the main dashboard (`/`) does not render the worker filter.
- **The write side refuses it today.** `needsWorker` (PAYOUT/BONUS only) both *requires* and *clears*
  the worker: `validate.ts:175-177` nulls `worker` on every other type. The fix is the split this repo
  already uses elsewhere (`showsInvestment` / `requiresInvestment`, `showsOtherCategory` /
  `needsOtherCategory`): a new "worker allowed" predicate that includes `OTHER`.
- **No migration.** `transactions.worker_id` exists (FK + index, `(worker_id, type)` index).
- **No money figure is contaminated.** Every reader of `worker_id` that feeds a worker's money
  („Pozostało do wypłaty”, settle-payouts, worker view, margin) filters to `PAYOUT`/`BONUS`. `OTHER`
  never reaches the owner's sheet. EX-1027's assumption „does not affect Pozostało do wypłaty” holds with
  no extra code.
- **Kasa is already there.** `OTHER` has a required source kasa. An `OTHER` paid from a worker's own
  kasa is already attributable (kasa owner) and already appears on his page. But the 104 existing
  „narzędzia” `OTHER` rows (24 940,20 zł in the local dump) were paid mostly from management kasy
  („Adrian konto mbank” 71, „Telmak” 14) — so kasa gives no per-worker attribution for them. The new
  field is what closes that gap.
- **Side effects to decide:** an `OTHER` with worker X appears on `/pracownicy/X` (and to X himself on
  his phone); the worker can't be added/changed after save (field is update-locked, edit form has no
  worker); a worker named on an `OTHER` blocks his hard delete.

## Detailed Findings

### Data model and predicates

- `src/collections/transfers.ts:206-215` — `worker` relationship (users), `access.update: () => false`,
  admin condition `needsWorker`. `:216-232` — `otherCategory` / `otherDescription` gated on
  `needsOtherCategory`. `:166-176` — `sourceRegister` (Kasa).
- `src/lib/constants/transfers.ts:561` — `needsWorker = PAYOUT || BONUS`. `:564` — `needsOtherCategory
  = OTHER`. `:571` — `showsOtherCategory = OTHER || INVESTMENT_EXPENSE(_NET) || PAYOUT`. `OTHER` spec:
  `sourceRegister: 'required'` (`:127`), `financialBucket: 'none'` (`:125`), no sheet tabs (`:122-123`).
- Worker semantics today: on `PAYOUT` the person paid; on `BONUS` the worker half of the
  investment × worker pair.
- DB: `worker_id` created in `src/migrations/20260211_213603.ts:16` (FK `:29`, index `:35`);
  `(worker_id, type)` index in `20260216_add_performance_indexes.ts:6`.

### Where `needsWorker` gates the write (all must move to the new predicate)

| Place | What it does |
|---|---|
| `src/hooks/transfers/validate.ts:171-177` | requires worker for PAYOUT/BONUS; **sets `d.worker = null` for everything else** |
| `src/lib/schemas/transfer-validation.ts:60-64` | same rule in Zod (client + server) |
| `src/lib/transfers/clear-fields-for-type.ts:30` | clears `worker` when the form switches to a type without it |
| `src/collections/transfers.ts:213` | admin visibility |
| `src/components/forms/expense-form/expense-form.tsx:392-394` | renders `EntityComboboxField variant="worker"` |

Required stays `needsWorker`; shown/allowed becomes e.g. `showsWorker = needsWorker || OTHER`.

### Write path — „Nowy wydatek” dialog

- Form: `src/components/forms/expense-form/expense-form.tsx`; submit maps `worker` at `:222`.
- Schemas: `src/components/forms/expense-form/bulk-expense-schema.ts` — client `worker: z.string()`
  (form level), server `createBulkExpenseSchema` `worker: z.number().optional()`.
- Action: `createBulkTransferAction`, `src/lib/actions/transfers.ts:~90-185`, writes `worker` into
  every row (`:144`). In „Kilka wydatków” the worker is **one per form, not per row** (like date, type,
  kasa); description / amount / category / FV / note vary per row.
- Edit: `edit-transfer-form.tsx` has no worker field and the field is update-locked, so a wrong worker
  = cancel + rebook, and existing rows can't be backfilled from the UI.
- `createdBy` can't answer „who bought it” — it is always the manager who booked
  (`actions/transfers.ts:148`).

### Readers of `transactions.worker_id`

| Reader | Type filter | Effect of `OTHER` + worker |
|---|---|---|
| `src/lib/db/get-payout-transactions.ts:24-28` („Pozostało do wypłaty”, worker view `kosztorys/worker-view/summary.ts:72-78`) | `type IN ('PAYOUT','BONUS') AND investment_id = …` | none |
| `src/lib/db/worker-payout-pairs.ts:46-53` (settle dialog, listing column) | `FILTER (WHERE type='PAYOUT'/'BONUS')`, `JOIN investments` | none |
| `calculate-margin.ts`, `margin-v2.ts` | by type/bucket, never worker | none |
| `src/lib/queries/transfer-filters.ts:130-133` (`?worker=`) → `where-to-sql.ts:18` | none | **matches — the wanted behaviour** |
| `src/lib/queries/worker-transfers.ts:5-12` (scope of `/pracownicy/[id]`) | none: `worker = id OR source/target kasa in his kasy` | **row shows on X's page, visible to X** |
| `src/lib/workers/delete-blocker.ts:25` | none | blocks hard delete of X |
| `validate.ts:115` `trashedWorkerMessage` | none | refuses a trashed worker — fine |

Google Sheets: `OTHER` never syncs (`hooks/transfers/sync-sheet.ts:50` returns early — not a sheet type,
no investment). The worker column in `lib/google/tab-rows.ts:107` is unaffected.

### Filtering and reporting

- List = dashboard `/` (`src/app/(frontend)/(dashboard)/page.tsx` → `ManagerDashboard`).
  `buildTransferFilters` (`src/lib/queries/transfer-filters.ts:46-163`) reads `type`, `otherCategory`
  (`:135-138`), `worker` (`:130-133`, `worker_id` only — not kasa owner, not `createdBy`), etc.
- **Dashboard gap:** the worker filter renders only when `workers` is passed
  (`components/transfers/transfer-filters.tsx:195-204`). `manager-dashboard.tsx:78` passes only
  `users: managementUsers` — so `/` has no „Pracownik” filter in the UI (URL `?worker=` still works).
  `/kasa/[id]` and `/inwestycje/[id]` use `buildFilterConfig` which includes workers
  (`build-filter-config.ts:26`).
- Filtered sum: `TransferTableServer` → `sumFilteredByType` (`src/lib/db/sum-transfers.ts:252-285`),
  shown as the `filteredSum` tile when any filter is set (`transfer-filters.tsx:279-286`). One total for
  the filter — „X and Y” selected together gives a combined figure, not a breakdown per person.
- Columns: „Kategoria” (`components/tables/transfers.tsx:128-133`) and „Pracownik” (`:185-198`, links to
  `/pracownicy/{id}`) render for any type.
- Category caveat: `otherCategory` also appears on `INVESTMENT_EXPENSE(_NET)` and `PAYOUT` (12
  „narzędzia” investment expenses in the dump) — the per-worker tools figure must also filter
  `type=OTHER`.
- `other-categories` (`src/collections/other-categories.ts`): one `name` field, managed only in `/admin`.
  Dump: 15 categories, `9 = narzędzia`. 0 `OTHER` rows carry a `worker_id` today.
- No report groups by `otherCategory`; `/raporty` is off (EX-598).

### Sprzęt (equipment)

`src/collections/equipment.ts` + `equipment-events.ts` (handover log, `holder` = user). Answers „what
does X hold”, not „how much was spent on X”. No link to transactions; `purchasePrice` is a free number.
Out of scope by design (`context/archive/2026-09-01-katalog-sprzetu/change.md:68-73`). The two remain
independent.

### Worker expense drafts (EX-971 / EX-1001)

Drafts carry `worker_id` + required kasa; on acceptance the form is prefilled with
`type: 'INVESTMENT_EXPENSE'`, `worker: ''` (`use-expense-draft-acceptance.tsx:67-72`), and the draft's
worker is lost on the booked row (only `worker_expense_draft_transfers` remembers). If the manager
switches an accepted draft to `OTHER`, prefilling `worker` from the draft is a cheap win. EX-1004 („who
reported this expense” filter) is a different question routed through the draft table.

## Code References

- `src/lib/constants/transfers.ts:561-572` — `needsWorker`, `needsOtherCategory`, `showsOtherCategory`
- `src/hooks/transfers/validate.ts:167-177` — category required on OTHER; worker required/cleared
- `src/lib/schemas/transfer-validation.ts:60-64` — Zod worker rule
- `src/lib/transfers/clear-fields-for-type.ts:30` — form clears worker on type switch
- `src/collections/transfers.ts:206-215` — `worker` field, update-locked
- `src/components/forms/expense-form/expense-form.tsx:222,392-394` — worker picker + submit mapping
- `src/lib/actions/transfers.ts:144,148` — bulk action writes `worker`, `createdBy`
- `src/lib/queries/transfer-filters.ts:130-138` — worker / otherCategory filters
- `src/components/dashboard/manager-dashboard.tsx:78` — dashboard passes no `workers`
- `src/lib/db/sum-transfers.ts:252-285` — filtered sum
- `src/lib/queries/worker-transfers.ts:5-12` — worker page scope
- `src/lib/db/get-payout-transactions.ts:24-28`, `src/lib/db/worker-payout-pairs.ts:46-53` — type-filtered money readers

## Architecture Insights

- **Shows vs requires split** is the established pattern for conditional transfer fields
  (`showsInvestment`/`requiresInvestment`, `showsOtherCategory`/`needsOtherCategory`). Using it keeps
  validation, the form's auto-clear and the admin condition reading one predicate each.
- **Money readers filter by type, not by field presence** — that is why adding a field to a new type is
  safe here. EX-979's lesson (`lessons.md:2525-2530`, five „Pozostało do wypłaty” computations) applies
  only if the worker on `OTHER` ever became a settlement figure; as an attribution label it doesn't.
- The worker page scope is an `or` over `worker` + kasy under `and` (`lessons.md:733-749`) — no change
  needed for safety; the new rows simply become visible through the existing branch.

## Historical Context (from prior changes)

- Commit `873bfe434` (2026-03-10) removed the worker relation from expenses as redundant: workers were
  to be represented by WORKER-type kasy. The field survived only for PAYOUT/BONUS. EX-1027 deliberately
  relaxes this, because purchases from management kasy can't be attributed by kasa owner.
- `context/archive/2026-10-05-worker-expenses/change.md:23-24` (EX-971) and
  `context/archive/2026-10-05-worker-account/change.md:28-29,44-46` (EX-985) restate „the only link to a
  worker is the source kasa owner” as the starting state, not as an owner ruling. EX-985 fixed the
  worker page scope as `worker = id OR his kasy`.
- Commit `7971ac558` (EX-777) added the „Pracownik” multi-select filter on `where.worker`.
- Commits `a568a21be` / `ad2a90520` made `otherCategory` optional for OTHER in the form/schema, while
  `validate.ts:167` still requires it — unrelated drift, noted below.
- `context/archive/2026-09-01-katalog-sprzetu/change.md:57-73` (EX-758) — equipment kept separate from
  expenses.
- Glossary (`context/domain/02-glossary.md`) has no entries for OTHER / otherCategory / sprzęt.

## Related Research

- `context/archive/2026-10-05-worker-expenses/` (EX-971)
- `context/archive/2026-10-05-worker-account/` (EX-985)
- `context/changes/2026-10-06-worker-expense-ai-prefill/` (EX-1001)

## Open Questions

Business (owner):

1. **Worker page.** An `OTHER` with worker X will show in X's „Moje transfery” on his phone (existing
   scope). Wanted, or should the worker page exclude `OTHER` booked from a non-WORKER kasa?
2. **Editing / backfill.** Should the worker be settable after save (edit form + lifting the update
   lock for `OTHER`)? Without it the 104 existing „narzędzia” rows stay unattributed and a mistake means
   cancel + rebook.
3. **Breakdown vs filter.** Is „filter by worker + Suma” enough, or does management want a table „worker
   → total on narzędzia” (new aggregate)?
4. **Batch mode.** One worker for all rows of „Kilka wydatków” (like kasa) — fine, or per row?
5. **Kasa vs worker disagree** (EX-1027 example: paid from Bartek's kasa, bought by someone else). The
   per-worker figure should read only `worker_id`; confirm.

Technical:

6. `validate.ts:167` requires `otherCategory` on OTHER while the form says „Opcjonalnie” — verify which
   wins on save; out of scope, but touches the same hook.
7. Add `workers` to the dashboard filter config (`manager-dashboard.tsx:78`) — needed for the filter to
   be usable on `/`.
8. Prefill `worker` from `draft.worker_id` when an accepted draft is booked as `OTHER`?

## Follow-up Research 2026-10-08 — owner decisions

1. **Worker page — yes.** An `OTHER` with worker X shows in X's transfers on `/pracownicy/X`, phone
   included. The existing scope (`worker-transfers.ts:5-12`) already does this; no change.
2. **Editable after save — yes.** The worker on an `OTHER` can be added or changed later. Implies: a
   worker picker in `edit-transfer-form.tsx` for `OTHER`, and the collection's
   `access.update: () => false` (`transfers.ts:211`) relaxed for `OTHER` only — on `PAYOUT` / `BONUS`
   the worker is a settlement figure („Pozostało do wypłaty”) and stays locked. Enables backfilling the
   104 existing „narzędzia” rows.
3. **Filter + Suma only (variant A).** „How much did X spend on narzędzia” = the existing list filter
   (type + kategoria + pracownik) and the filtered-sum tile. A per-worker breakdown table is out of
   scope — no such aggregate exists anywhere in the app and none is added now. Still owed: the
   „Pracownik” filter on the dashboard `/` (`manager-dashboard.tsx:78`).
4. **Per row in „Kilka wydatków”.** The worker moves from the form level (`bulk-expense-schema.ts:44`
   client, `:105` server) into the line item for `OTHER`. `PAYOUT` / `BONUS` keep one worker per form
   (a payout row without its worker is invalid, and today's UX picks it once). The action
   (`actions/transfers.ts:144`) then reads `item.worker ?? parsed.data.worker`.
