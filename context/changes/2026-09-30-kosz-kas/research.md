---
date: 2026-09-30T13:07:06+02:00
researcher: Claude Opus 5.5
git_commit: 6b02742f
branch: staging
repository: wykonczymy
topic: "Trash for an unused kasa (EX-917) — every reader, writer, gate and cascade a trashed cash register touches"
tags: [research, codebase, kosz, trash, cash-registers, reference-data, transfers, soft-delete]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude Opus 5.5
---

# Research: Trash for an unused kasa (EX-917)

**Date**: 2026-09-30T13:07:06+02:00
**Researcher**: Claude Opus 5.5
**Git Commit**: 6b02742f
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does a trash for cash registers touch? Specifically: every reader that must hide a trashed kasa (and
the ones that must keep its name); every write path that must refuse it; the delete-forever cascades
and their cache tags; the purge; the UI entry point; the shared `/kosz` prep (`TRASH_KINDS`, the
retention constant); tests to mirror; and the migration. The owner's decisions from 2026-09-30
(`change.md`) are fixed inputs.

## Summary

The schema is easy and the application is not. Four FKs point at `cash_registers.id`, and none of them
blocks a delete (§1). The existing `beforeDelete` probe already encodes the owner's "unused = no live
transactions" rule, so trash and delete-forever can share it once it is lifted into a `makeDeleteBlocker`
module (§2).

The work is in three places:

1. **`fetchReferenceData` is both the picker source and the name map for every transaction row.**
   Filtering trashed kasy out of its SQL (the way investments did it) would blank the kasa name on their
   cancelled rows. The fix is to select `trashed_at` into the ref row and filter per consumer. There are
   about 15 picker and listing consumers, and exactly one name-map consumer (§3).
2. **A trashed kasa can be booked into today.** `targetRegister` is never validated, and
   `validateSourceRegister` checks existence only. Worse, a user whose saved default kasa is trashed gets
   an empty-looking picker whose field value still holds the trashed id, so the transfer lands in the
   trashed kasa silently. The gate belongs in the transfers `validate` hook, mirroring the investment
   gate. The default must also be cleared on trash (§4).
3. **Code contradicts two recorded decisions.** The owner of a kasa *can* be changed today (edit dialog
   → `updateCashRegisterAction`), despite "a kasa cannot be handed over". And MANAGER parity collides
   with collection access (`delete: isAdminOrOwner`, MAIN hidden from managers) (§6).

Balances are computed from live transactions only, so a trashable kasa has a balance of 0 and no total
moves. Nothing reaches Google Sheets (§5).

## Detailed Findings

### 1. References to `cash_registers.id`

Verified against the local DB with `pg_constraint WHERE confrelid = 'cash_registers'::regclass`. All
child columns are nullable:

| Child column                                       | ON DELETE | Origin                                                   |
| -------------------------------------------------- | --------- | -------------------------------------------------------- |
| `transactions.source_register_id`                  | SET NULL  | `src/migrations/20260211_213603.ts:27` (renamed 20260222) |
| `transactions.target_register_id`                  | SET NULL  | `src/migrations/20260218_transaction_type_overhaul.ts:14-16` |
| `users.default_cash_register_id`                   | SET NULL  | `src/migrations/20260221_201112.ts:6`                    |
| `payload_locked_documents_rels.cash_registers_id`  | CASCADE   | `src/migrations/20260211_212425.ts:78`                   |

Nothing else points at a kasa: no equipment, leads, sheets or kosztorys FK.

The outgoing `cash_registers.owner_id` is `NOT NULL` but declares `ON DELETE SET NULL`
(`20260211_212425.ts:9,63`). Deleting a user who still owns a kasa therefore fails with a raw `23502`.
The users `beforeDelete` probe (`src/collections/users.ts:46-53`) exists to turn that into a sentence.
**A trashed kasa must keep counting there**: its `owner_id` is still NOT NULL. For EX-918, "worker +
empty kasa" therefore means the kasa is deleted before the user, in one transaction. The probe already
forwards `req` for exactly that (`src/lib/db/delete-blocker.ts:54-55`).

`cash_registers.name` is **not unique**, neither in the collection (`src/collections/cash-registers.ts:56-61`)
nor in the DB (only the pkey is unique). So a restore can never collide on name, unlike szablony.

### 2. "Unused" — the predicate trash and delete share

- `src/collections/cash-registers.ts:16-29` holds
  `preventDeleteWithTransactions = makePreventDelete({ probes: [{ collection: 'transactions', where: id => excludingCancelled({ or: [sourceRegister = id, targetRegister = id] }), label: 'transakcje' }], message })`.
- Cancelled rows have been exempt since `7728e424` (2026-08-28), which reversed `b95c4f9e`. The rationale
  is in `src/lib/db/delete-blocker.ts:4-17`: no figure reads a cancelled row, and the audit view still
  reaches it.
- The investment trash refuses on exactly its hard-delete predicate (`investmentDeleteBlocker`,
  `src/lib/investments/delete-blocker.ts`, built with `makeDeleteBlocker`). For kasy the probe exists
  only inline in the collection hook, so it must be lifted into a `makeDeleteBlocker` module (e.g.
  `src/lib/cash-registers/delete-blocker.ts`). Then `beforeDelete: [refuseDeleteWhen(blocker)]` and the
  trash action share one predicate (lessons.md: "trash refuses on exactly what beforeDelete refuses on").
- There is no in-app delete for kasy today, only `/admin`, which is unused. Delete-forever will be the
  first app path through `payload.delete` on `cash-registers`.
- The existing spec `src/__tests__/collections/cash-registers-delete-guard.test.ts` already pins both
  halves: a live row blocks, and a cancelled-only kasa deletes with `source_register_id` set to NULL.

### 3. Readers — hide vs keep-for-name

The chokepoint is `fetchReferenceData` (`src/lib/queries/reference-data.ts:53-57, 99-105`):
`SELECT id, name, type, active, owner_id FROM cash_registers ORDER BY name`. There is no WHERE clause,
so inactive kasy are included. It is cached under key `['reference-data-v2']`, tagged `collection:cash-registers`,
`users` and others (`:156-167`). The row type is `CashRegisterRefT` (`src/types/reference-data.ts:16-18`).
`src/__tests__/reference-data-sql-drift.test.ts:19` catches a mapped field missing from the SELECT.

**The one keep-for-name consumer.** Transaction rows are fetched at `depth: 0`, and kasa names are
joined in afterwards from ref data: `transfer-table-server.tsx:37` → `buildTransferRows` →
`buildTransferLookups` → `transfer-mapping.ts:32` `toNameMap(refData.cashRegisters)` → `lookupName`
(`:93-94`), which falls back to `'—'` (`:109-111`). `tables/transfers.tsx:131-154` suppresses the link
when the name is `'—'`. The same path feeds exports and invoices (`fetch-transfer-rows.ts:35-44`,
`fetch-transfers-for-invoices.ts:37`). **This map must keep trashed kasy**, or their cancelled rows show
„—" while the kasa is still restorable.

**Hide consumers.** None of these filter on anything today except as noted:

| Consumer | Kind | Today |
| --- | --- | --- |
| `src/lib/queries/cash-registers.ts:8-37` (`fetchVisibleRegisters`) → `/kasy` table + `RegisterBalanceChart`, manager dashboard tiles (`user-register-stats.tsx`) | listing | all kasy; MAIN dropped for MANAGER (`:35`) |
| `src/app/(frontend)/kasa/[id]/page.tsx:48-49` | detail | `notFound()` if absent |
| `src/app/(frontend)/(dashboard)/page.tsx:17-25` | employee redirect to own WORKER kasa | no filter; absent → `notFound()` |
| `src/lib/utils/build-filter-config.ts:22,34` → `transfer-filters.tsx:172-179`; `manager-dashboard.tsx:52` | filter options | none |
| `src/components/forms/form-fields/cash-register-field.tsx:33-38` (+ `source-register-field.tsx`) used by expense (`:320,335`), deposit (`:251`), internal transfer (`:83,94`), settle payouts (`settle-payouts-form.tsx:164-170`), worker form (`worker-form.tsx:88-94`) | pickers | `activeOrSelected` — keeps the selected id even if inactive |
| `src/lib/utils/default-cash-register.ts:6-19` (expense `:118,144,262,325`, deposit `:85`, internal `:57`); `src/lib/queries/settle-payouts.ts:62-73` | default preselect | returns the saved id unchecked |
| `pracownicy/page.tsx:27-29`, `pracownicy/[id]/page.tsx:45-47` („Domyślna kasa") | name display | none |

**Out of `fetchReferenceData`:**

- `src/lib/db/sum-transfers.ts`, `src/lib/queries/balances.ts`, `register-balance.ts` and `where-to-sql.ts`
  aggregate transactions by register id and never read `cash_registers`. A trashable kasa has no live
  rows, so no change is needed.
- Payload admin relationship fields (`users.ts:142-147`, `transfers.ts:164-183`) have no `filterOptions`.
  The admin panel is unused (memory), so ignore them.
- Google Sheets, notifications, snapshots and `src/app/api` have no cash-register reads.

**Pitfall in the pickers: `activeOrSelected` is a hint, the trash is an exclusion.**
`src/lib/utils/is-active-ref.ts:11-17` keeps whatever is selected, even when inactive, because dropping
it silently wrote the emptied value back on save (EX-643, `33ac789e`). The umbrella research
(`kosz-pozostalych-encji/research.md:342-346`) already concluded the trash must be a **hard exclusion**,
filtered before `activeOrSelected`.

The worse failure is the reverse. When the saved id is *absent* from the options (because it was
filtered out), `SearchSelect` shows the placeholder (`search-select.tsx:55,79`) while the form value
still holds the id. Zod passes it, and `validateSourceRegister` only checks existence. **The user sees
an empty picker and the transfer books into the trashed kasa.** That is why §4's write gate is mandatory
and not belt-and-braces.

### 4. Write paths that take a kasa id

- **`validateSourceRegister`** (`src/lib/actions/validate-source-register.ts:15-30`) runs raw SQL by id
  and checks existence only (not `active`, not trash). Callers are `createTransferAction`
  (`src/lib/actions/transfers.ts:49`), `createBulkTransferAction` (`:98`) and `settlePayoutsAction`
  (`src/lib/actions/settle-payouts.ts:47`). **`targetRegister` is never validated** (`transfers.ts:129-130`).
- **The transfers `validate` hook is the complete gate.** Transactions have no raw-SQL writer outside
  seeds (`src/hooks/transfers/validate.ts:61-63`). The investment gate is wired there:
  - It runs above both early returns: CANCELLATION and cancelled-update, `:61-77`.
  - `resolved(field)` = data-or-original (`:48-59`).
  - It skips an invoice-only patch (`isInvoiceOnlyPatch`).
  - It calls `getDb(req.payload, req)` and then `investmentLockMessage(db, id)` → `lockMessageOf`
    (`src/lib/db/investment-gate.ts:34-43`).
  - It throws `APIError(message, 403)`. It must be `APIError`, because a bare `Error` becomes a 500.

  A kasa gate mirrors this for `sourceRegister` and `targetRegister`. Register fields are
  `access.update: () => false` (`collections/transfers.ts:165-184`), and `updateTransferSchema` has no
  register field (`src/lib/schemas/transfer.ts:51-65`), so in practice only a create can name a kasa.
  The action-level mirror (`relatedInvestmentLockMessage` at `transfers.ts:56-60,103-107`) exists only
  to turn the refusal into a readable sentence before the write. `validateSourceRegister` is the natural
  place for the kasa equivalent, but it covers the source only.
- **Cancelled rows are immutable in the app.** `fetchAndAuthorize` refuses them (`transfers.ts:176-177`).
  Invoice attach goes through Local API `payload.update`, which merges the stored doc, so `cancelled` is
  present and `validate.ts:96-98` returns early. A NULL register after delete-forever therefore never
  trips "Cash register is required" (`:121`). CANCELLATION rows never reference a kasa (`validate.ts:92`;
  0 rows locally).
- **`users.default_cash_register_id` writers:** `setDefaultCashRegisterAction`
  (`src/lib/actions/user-preferences.ts:12-28`, no validation) and `createWorkerAction` /
  `updateWorkerAction` (`src/lib/actions/workers.ts:13,34`, via `worker-schema.ts:20`). Each needs the
  same trashed-kasa refusal, or a default can be re-pointed at a trashed kasa after the trash cleared it.
- **Kasa writers:** `createCashRegisterAction` / `updateCashRegisterAction`
  (`src/lib/actions/cash-registers.ts:30,48`; `withinManagerScope` `:11-28` strips `type`/`active` for
  MANAGER). `toggleCashRegisterActive` (`src/lib/actions/toggle-active.ts:54-61`) runs `MANAGEMENT_ROLES`
  + `overrideAccess`, so a MANAGER can already toggle `active` despite the field access. An edit or
  toggle on a trashed kasa is unreachable from the UI once `/kasa/[id]` 404s and `/kasy` hides it. A
  server-side refusal is the same "lock writes at the existing gate" rule, and cheap.

### 5. Cascades, cache tags, Sheets

- **Trash / restore** change only `cash_registers.trashed_at` (+ the default-kasa clear, §4). Tags:
  `CACHE_TAGS.cashRegisters` (`collection:cash-registers`) expires `fetchReferenceData`. If the default
  is cleared, also `users` (already on `fetchReferenceData`).
- **`entityTag('cash-register', id)` is produced but never consumed.** It is expired in
  `src/hooks/transfers/recalculate-balances.ts:26-31,52-53`, but no `unstable_cache` reader carries it.
  A kasa trash gains nothing from an entity tag unless it introduces a per-kasa cached reader. It should
  not invent one.
- **Delete-forever** fires SET NULL on cancelled `transactions` rows (hookless) and on
  `users.default_cash_register_id`. Per lessons.md:246-251, list the child tags: `transfers` (row reads,
  audit view) and `users`. `fetchRegisterBalances` is tagged `transfers` only (`balances.ts:30`), which
  that covers.
- **Revalidation context:** actions use `protectedAction`'s tag list (`updateTag`); the cron purge uses
  `revalidateTag(tag, EXPIRE_NOW)` (`src/lib/investments/purge-trash.ts` is the pattern).
- **Google Sheets:** transfer rows carry no kasa column (`tab-rows.ts:64-70,102-109`) and the sheet
  mirrors only non-cancelled rows (`sheets-sync.ts:139,365-367`). Neither trash nor delete-forever
  touches a sheet.

### 6. Roles, ownership and the recorded decisions

- `/kasy` requires `MANAGEMENT_ROLES` (`kasy/page.tsx:11-12`). `fetchVisibleRegisters` hides **MAIN** from
  a MANAGER. `/kasa/[id]` lets every role in, with a 404 on MAIN for non-A/O and on another user's kasa
  for EMPLOYEE (`page.tsx:21,54,57`).
- Collection access: read/create/update A/O/M; **delete A/O** (`e2d4bcff`, 2026-03-11); `active` field
  A/O. Managers are forced to AUXILIARY (`476fcfd4`). No written owner ruling backs these; they are the
  owner's own commits.
- MANAGER parity (umbrella decision 2026-09-29) therefore means the trash actions run with
  `overrideAccess`, like the investment trash. The investment trash pinned the role rule at the action
  layer (the DB spec mocks the session), not with an E2E (`kosz-inwestycji-manager/change.md:27-29`).
  An open point: a MANAGER cannot *see* MAIN kasy anywhere, so the kasa section of `/kosz` and the trash
  action either hide/refuse MAIN for MANAGER or show it. Locally every MAIN kasa has live transactions,
  so the question is theoretical but cheap to settle.
- **"A kasa cannot be handed over to another owner" is not true in code today.** The edit dialog
  pre-fills `owner` and lets it change (`edit-cash-register-dialog.tsx:30`, `cash-register-form.tsx:76`
  with `items={workers}`, `updateCashRegisterAction`). Either this change locks `owner` on update, or
  the decision is read as "we will not build a handover in the trash flow", which is the EX-918
  consequence: a worker with a used kasa is not trashable.
- **WORKER kasa creation is manual.** `createWorkerAction` creates no kasa. The only automatic creation
  was the one-off migration `20260310_workers_as_registers.ts`. One user can own several kasy (locally:
  users 16 and 17 own 5 each).
- **Employee dashboard.** An EMPLOYEE without a visible WORKER kasa gets `notFound()`. Locally, **21
  active employees are already in that state** (e.g. users 56, 58, 59, 63-65 own AUXILIARY kasy only).
  So trashing a WORKER kasa of an active employee produces a state the app already has, not a new
  failure mode. It is still the wrong outcome for the person. EX-918's pairing (worker + empty kasa
  together) is the intended route; whether a standalone WORKER-kasa trash is allowed at all is a plan
  decision.

### 7. Local data profile (dev DB, 5433, restored prod dump)

The DB has 38 kasy. These are trashable under "no live transactions":

| id | name                    | type      | active | live / cancelled txns | note |
| -- | ----------------------- | --------- | ------ | --------------------- | ---- |
| 6  | Kasa pomocnicza Bartek  | AUXILIARY | no     | 0 / 0                 |      |
| 42 | Farby Dulux Telmak      | AUXILIARY | yes    | 0 / 0                 |      |
| 30 | Kasa - test             | WORKER    | yes    | 0 / 1 (#3403)         | owner 45 is an active EMPLOYEE; the only real SET NULL case |
| 31 | Kasa - test123          | WORKER    | yes    | 0 / 0                 | owner 46 is an active EMPLOYEE |

None of the four is anyone's default kasa. Every other WORKER kasa has live transactions.

### 8. The existing trash — what a second kind plugs into

- **Actions:** `src/lib/actions/investment-trash.ts` has trash, restore and delete-forever.
  - Each runs `protectedAction` → `withPayloadTransaction` → idempotent `findByID` → blocker →
    `payload.update({ trashedAt })`.
  - It passes `context: SKIP_HOOK_REVALIDATION`, because the action's tag list is the revalidation.
  - Delete-forever requires `trashedAt`, applies the typed-name rule, then
    `deleteTrashedInvestment` → `payload.delete`, which re-runs `beforeDelete`.
- **DB and queries:** `src/lib/db/investment-trash.ts` (`fetchTrashedInvestments`,
  `selectPurgeableInvestmentIds` using `trashed_at < now() - make_interval(days => n)`) and
  `src/lib/queries/trash.ts` (`getTrashedInvestments`: `requireAuth(MANAGEMENT_ROLES)`, uncached,
  `daysLeft`).
- **Purge:** `src/lib/investments/purge-trash.ts` is serial and counts purged / skipped / blocked /
  failed with `TODO(EX-449) SENTRY-REQUIRED`. It is called as the `trash` step of
  `src/app/(payload)/api/cron/cleanup/route.ts` via `runStep`, daily at 03:00.
- **UI:** `src/app/(frontend)/kosz/page.tsx` → `components/trash/trash-contents.tsx`, which renders two
  `TrashSection`s filtered on `isTemplate`. `trash-section.tsx` owns `fateOf()` and the row list.
  `trashed-investment-actions.tsx` and `delete-forever-dialog.tsx` hold the copy (`INVESTMENT_COPY` /
  `TEMPLATE_COPY`) and the typed-name dialog.
- **Retention constant:** `TRASH_RETENTION_DAYS = 30` sits in `src/lib/constants/investment-lock.ts:13`,
  which is Payload-CLI-graph safe. It is read by `queries/trash.ts:7`, `investments/purge-trash.ts:6`
  and the test helpers (`__tests__/helpers/investment.ts:3,44-45`, `lib/db/investment-trash.db.test.ts:4`).
  The planned `kosz-plikow` defines its own `TRASH_RETENTION_DAYS = 7` (`kosz-plikow/plan.md:84`), which
  collides by name. The move should give the kosz constant a name that cannot collide.
- **Entry button:** `src/components/investments/trash-investment-button.tsx`.
  - A ghost `DeleteButton` opens a neutral `ConfirmDialog` („Przenieść do kosza?" / „Przenieś do kosza").
  - It is never pre-disabled; the server refusal is toasted.
  - It is mounted in the `actions` column of `components/tables/investments.tsx:317-327`.
  - `/kasy` has **no actions column** today (`components/tables/cash-registers.tsx:25-63`); its only row
    control is `ActiveToggleBadge`.

**`TRASH_KINDS` vs "no generic abstraction".** kosz-inwestycji (`archive/2026-09-24-kosz-inwestycji/change.md:43-46`)
ruled out a generic *backend* abstraction: each kind brings its own column, hiding, gates and cascades.
The EX-914 review note (`archive/2026-09-29-kosz-szablonow/review-gate.md:21,26`) defers only a
**UI/copy-level** table to the second kind: `kind` on the trash row, a `Record<TrashKindT, …>` with
section title, restore toast, delete copy and actions, and the per-kind `mustTypeName` as a SQL fragment
selected onto the row. These do not conflict as long as the table stays in `components/trash/` and
`queries/trash.ts`. `INVESTMENT_TRASH_TAGS` stays unsplit (`review-gate.md:23`).

### 9. Tests to mirror

| Existing spec | What it pins | Kasa twin |
| --- | --- | --- |
| `src/__tests__/lib/actions/investment-trash.db.test.ts` | Real DB; session mocked through `get-current-user-jwt`; shared cache stub. MANAGER may do all three and EMPLOYEE none; a live txn blocks and a cancelled one doesn't; restore round-trips; delete-forever refuses non-trashed. Asserts persisted `trashed_at` | `lib/actions/cash-register-trash.db.test.ts` |
| `src/__tests__/lib/db/investment-trash.db.test.ts` | Purge selection past retention (`trashDaysAgo`, hardcoded to `investments`), listing order | `lib/db/cash-register-trash.db.test.ts`; generalise or twin `trashDaysAgo` |
| `src/__tests__/lib/investments/purge-trash.db.test.ts` | Which rows survive the purge | twin for kasy |
| `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` | Step forwarding, partial failure → `ok:false` | add the kasa step key |
| `src/__tests__/components/trash/trash-contents.test.tsx`, `delete-forever-dialog.test.tsx` | Sections appear only when non-empty; typed-name gating | extend for the kasa kind |
| `src/__tests__/collections/cash-registers-delete-guard.test.ts` | Live blocks; cancelled-only deletes with FK nulled | keep green after lifting the probe |
| `src/__tests__/hooks/transfers/validate-lock.test.ts` | Hook-level gate against a fake `drizzle.execute` | kasa-gate twin (source and target) |
| `src/__tests__/reference-data-sql-drift.test.ts` | SELECT vs mapped fields | covers the new `trashed_at` column |

Helpers: `transfer-fixtures.ts:8` `createRegisterOwner` (user + AUXILIARY kasa) and
`purge-fixture-users.ts:24` `purgeFixtureUsers`.

`context/foundation/test-plan.md:66` risk **#15** ("a trashed entity leaks back into a list or picker…
every reader filters `trashed_at` by hand, so one missed reader fails open") is the anchor. It has no
row in the Risk Response Guidance table yet. Risk **#3** (ledger drift, `:54`) is adjacent: the write
gate must not block a legitimate booking.

### 10. Migration

- Latest: `src/migrations/20260930_1_add_kosztorys_stage_workers.ts`, the last entry in
  `src/migrations/index.ts`.
- Template: `src/migrations/20260928_0_investment_trashed_at.ts`, hand-written. `up` is
  `ALTER TABLE ... ADD COLUMN "trashed_at" timestamp(3) with time zone`; `down` drops it.
- Additive, so on deploy prod is migrated **before** the push.
- The collection field mirrors `src/collections/investments.ts:161-166` (`trashedAt`, `type: 'date'`,
  `admin.hidden`).
- Shared tree: `git status src/migrations` before any migrate. Another session's uncommitted migration
  files are also present right now.

## Code References

- `src/collections/cash-registers.ts:8-12,16-29,45-46,53,56-62,90-93` — manager AUXILIARY rule, the delete probe, revalidate hooks, access, fields
- `src/lib/db/delete-blocker.ts:18-20,46-72` — `excludingCancelled`, `makeDeleteBlocker`
- `src/lib/queries/reference-data.ts:53-57,99-105,156-167` — the kasa SELECT, mapping, cache key and tags
- `src/lib/queries/transfer-mapping.ts:32,93-94,109-111` — the name map and the „—" fallback
- `src/lib/utils/is-active-ref.ts:11-17` — `activeOrSelected` keeps the selected id
- `src/lib/utils/default-cash-register.ts:6-19` — unchecked default preselect
- `src/lib/actions/validate-source-register.ts:15-30` — existence-only source check
- `src/hooks/transfers/validate.ts:48-77,92,96-98,121-147` — the complete write gate and where the investment gate hooks in
- `src/lib/db/investment-gate.ts:34-43` — `lockMessageOf`, the pattern for a kasa gate
- `src/lib/actions/user-preferences.ts:12-28`, `src/lib/actions/workers.ts:13,34` — default-kasa writers
- `src/lib/actions/cash-registers.ts:11-28,48-65` — `withinManagerScope`, owner is editable
- `src/app/(frontend)/(dashboard)/page.tsx:17-25` — employee redirect / `notFound()`
- `src/lib/queries/cash-registers.ts:24-37` — `/kasy` and dashboard listing, MAIN hidden for MANAGER
- `src/collections/users.ts:46-53` — user delete probe counts owned kasy (must keep counting trashed ones)
- `src/lib/actions/investment-trash.ts`, `src/lib/db/investment-trash.ts`, `src/lib/queries/trash.ts`, `src/lib/investments/purge-trash.ts`, `src/app/(payload)/api/cron/cleanup/route.ts` — the pattern
- `src/components/trash/*`, `src/components/investments/trash-investment-button.tsx` — UI pattern
- `src/lib/constants/investment-lock.ts:13` — the retention constant to move

## Architecture Insights

- **The chokepoint rule has a twist here.** For investments, hiding in `fetchReferenceData`'s SQL was
  correct because no transaction row reads an investment name from it. For kasy the same list is a
  name map, so the chokepoint is a flag on the ref row plus one shared filter (e.g. a `liveRegisters()`
  helper or a pre-split `cashRegisters` / `cashRegisterNames`). The split is the more fail-safe shape:
  a consumer cannot forget a filter on a list that never contained the trashed kasa. The name map keeps
  everything. This is the "one missed reader fails open" risk (#15) turned into a type-level default.
- **Hard exclusion before hint.** Trash filtering must run before `activeOrSelected`. The EX-643
  "keep the selected" behaviour is right for `active` and wrong for trash, because a trashed kasa has no
  valid reason to be selected.
- **The write gate is the real guarantee.** The picker filter only hides; the `validate` hook refusal
  is what stops a booking. That also covers stale forms left open across a trash.
- **Seam for EX-918.** The kasa trash state (`trashed_at`), the blocker and a DB-level
  "trash this kasa" helper that takes a `req` (so it joins the caller's transaction) let EX-918 trash
  the pair atomically without a second code path.

## Historical Context (from prior changes)

- `context/archive/2026-09-24-kosz-inwestycji/change.md:27-59` — live transactions always block;
  30-day auto-purge; typed name only when something valuable is lost; one `/kosz` with a section per
  kind; no generic backend abstraction; trashed = gone from listing, pickers and totals.
- `context/archive/2026-09-29-kosz-inwestycji-manager/change.md:19-29` — MANAGER parity, pinned at the
  action layer, no E2E.
- `context/archive/2026-09-29-kosz-szablonow/review-gate.md:21,23,26` — `TRASH_KINDS` deferred to the
  second kind; tags stay unsplit.
- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` § 5, § 6.4, § 7 — umbrella research;
  says "clear the default on trash" and "trash must be a hard exclusion" (`:242,342-346`).
- `7728e424` (2026-08-28) — cancelled rows stopped blocking deletes. `b95c4f9e` (2026-08-19) was the
  opposite ruling, now reversed.
- `33ac789e` (EX-643) — `activeOrSelected`, and why a picker must not silently empty a selection.
- `a955b204` (2026-03-10) — employees land on their WORKER kasa instead of their own pages.

## Related Research

- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md`
- `context/archive/2026-09-24-kosz-inwestycji/` (research + plan)

## Open Questions

For the plan, each needing an owner or design decision:

1. **Auto-purge after 30 days?** Every trashable kasa is empty by definition, so nothing needs a manual
   „tylko ręcznie" state, unless a kasa with cancelled rows should.
2. **Delete-forever confirm:** plain confirm, or a typed name when the kasa has cancelled transactions?
   Those rows lose their kasa name for good.
3. **Standalone trash of a WORKER kasa:** allowed (the employee lands on a 404 dashboard, a state 21
   employees already have), refused while the owner is an active EMPLOYEE, or refused always and left
   to EX-918's pair?
4. **Owner handover:** lock `owner` on `updateCashRegisterAction` in this change, or read decision 3 as
   "no handover inside the trash flow" only?
5. **MANAGER and MAIN kasy:** MANAGER cannot see MAIN anywhere. Should the trash action refuse MAIN for
   MANAGER and hide it in `/kosz`?
6. **Default kasa on trash:** clear it (restore does not bring it back; the umbrella recommends this),
   or keep it and have every reader ignore a trashed default? The latter keeps it through a restore but
   needs a filter in four preselect paths plus `/pracownicy`.
7. **Name-map shape:** a `trashed` flag with a shared filter helper, or split ref data into
   `cashRegisters` (live) and `cashRegisterNames` (all)? Either way the cache key becomes
   `reference-data-v3`.
8. **Cancelled rows linking to a trashed kasa:** keep the name but suppress the link (the detail page
   404s while trashed), or keep the link and let the detail page render trashed kasy read-only?
