---
date: 2026-10-19T14:13:49+02:00
researcher: Claude (Opus 5.5)
git_commit: 4c456b4e1d08cac5e3d8954d00bc82762a53ec28
branch: big-bag-order
repository: wykonczymy
topic: "Order a big bag / container from an investment: profiled expense form, supplier SMS, Czeka/Dostarczone status"
tags: [research, codebase, transfers, expense-form, globals, investments, users, sms]
status: complete
last_updated: 2026-10-19
last_updated_by: Claude (Opus 5.5)
---

# Research: Order a big bag / container from an investment

**Date**: 2026-10-19T14:13:49+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 4c456b4e1d08cac5e3d8954d00bc82762a53ec28
**Branch**: big-bag-order
**Repository**: wykonczymy

## Research Question

What does the codebase offer — and what must be added — for the decisions in `change.md`:

- a „Zamów big bag / kontener” button on the investment page and in the investments list's „Akcje”;
- a profiled expense form with a price-list amount;
- a supplier list with a global default;
- an SMS dialog after save;
- an order status `Czeka` → `Dostarczone` on the transfer;
- `users.phone` and an investment „Kierownik budowy”?

## Summary

- **The expense form can be profiled, but not through `prefill`.**
  - `prefill` is bound to a worker expense draft: `createBulkTransferAction` decides paragons on `expenseDraftId` and fails without one.
  - It needs a new initial-values prop that replaces `blankValues`.
  - It needs a new save hook that hands back what was created.
  - Every field stays editable as-is.
- **The form is mounted only in the top nav.**
  - The investments list page fetches no `referenceData`.
  - The investment page does fetch it.
  - The list needs either the fetch or a lazy load.
- **Order status = a sibling of `payoutStatus`.**
  - A Postgres enum column on `transactions`, nullable.
  - It is set by the order flow's create, not by type; `validate.ts` stays untouched.
  - It is flipped by `payload.update` (with `skipSheetSync`), expiring `['transfers']`.
  - It shows as a badge in the card's right slot and in a table column.
  - Rows come through `payload.find`, so no SELECT list needs editing.
- **Settings (suppliers, default, prices) fit a new hidden global, not `notification-recipients`.**
  - `notification-recipients` is saved by a read-modify-write that spreads only `RECIPIENT_LISTS`.
  - A new hidden global avoids that coupling.
- **`users.phone` and `investments.site_manager_id`** are plain additive migrations with clear precedents.
  - The kierownik picker is `refData.workers.filter(isActiveRef)`, which already means "any active, non-trashed account".
  - **Trap:** the notes save (`investment-notes.tsx`) sends a partial investment through `investmentSchema`, so a kierownik key defaulting to null would be wiped on every notes save.

## Detailed Findings

### 1. Expense form: profiling, mounting, save

- **`prefill` cannot be reused.**
  - `ExpenseFormPrefillT` requires `expenseDraftId`.
  - `onSubmit` passes it to `createBulkTransferAction`, which runs `decideExpenseParagons` and locks a pending worker draft.
  - With no draft, the save fails.
  - The new prop must replace `blankValues` (`expense-form.tsx:207-215`) and carry no draft id.
- **Form model.**
  - Top level holds `type`, `investment`, `settled` (one checkbox) and more.
  - Each line is a `BulkLineItemT`: `description`, `amount`, `netAmount`, `category` (other category), `expenseCategory`, `worker`, …
  - **No quantity exists anywhere** in the form or the `transactions` table.
- **Type switch** clears dependent fields. Switching to the netto variant drops `settled`. The order button must prefill after the type is set, not race it.
- **Submit.**
  - `createBulkTransferAction` (`src/lib/actions/transfers.ts:128-247`) returns `{ success: true }` with no ids.
  - `useFormSubmit` calls `onSaved` only on the awaited path (`keepOpen` / `awaitBeforeClose`).
  - The order flow needs:
    - the created id(s), so it can stamp the status (or the action stamps the status itself when given an order flag);
    - an awaited save, so the SMS dialog opens only after a real write.
- **Chaining a second dialog after save.** The precedent is the review prompt:
  - `edit-investment-dialog.tsx:81-88` → `investment-form.tsx:104-106` `onSaved`;
  - → `review-prompt-store.ts` → `ReviewPromptHost` mounted in `(frontend)/layout.tsx:104`.
  - The follow-up dialog opens after the first one closes.
- **Mounting.**
  - `ExpenseDialog` (`dialogs/expense-dialog.tsx`) is mounted only in the top nav, for management, and takes `referenceData`.
  - It picks the investment via `useInvestmentFromUrl` (`/inwestycje/(\d+)`), but only if `isOfferedForBooking`. Locked investments are not offered.
  - The investments list page fetches no `referenceData`.
  - The row-dialog precedent is `onSettle` + `useState` in `investment-data-table.tsx:74-80`.
- **No-invoice confirm.** `missingInvoiceConfirm` will ask „brak faktury” on every order. An order has no invoice at order time.
- **Gating.** A MANAGER can already book `INVESTMENT_EXPENSE`; no new role gate is needed.
- **Category resolution.**
  - The only precedent resolves by name (`resolveExpenseCategoryId`).
  - Both dictionaries (`expense-categories.ts`, `other-categories.ts`) have a single unique `name`, no slug.
  - Local data: „Materiały budowlane” = id 1, „big bag” = 10, „kontener” = 11.
  - Options:
    - **(a)** a nullable unique `key` column on the dictionaries, backfilled by name;
    - **(b)** store the three ids in the new settings global;
    - **(c)** hard-coded ids (no);
    - **(d)** name match (ruled out in change.md).
  - **(b)** needs no dictionary migration and no backfill, and it is editable when someone renames a category.

### 2. Settings: suppliers, global default, price list

- **No settings page exists.**
  - Recipient lists are edited inline through `RecipientListCard` on /flota, /sprzet and /zgloszenia.
  - Visible to management; editable only with `isAdminOrOwnerRole`.
- **Why `notification-recipients` doesn't fit.**
  - Its save action (`src/lib/actions/notification-recipients.ts`) uses `ownerOnlyAction`.
  - It does `findGlobal` → `updateGlobal` and spreads only `RECIPIENT_LISTS`.
  - Adding suppliers, a default and prices there means carrying them through that spread.
  - The MANAGER-writable default would also sit in an otherwise owner-only global.
- **A new hidden global (e.g. `order-settings`)** — scalars plus a `suppliers` array, with its own cache tag — keeps the two apart.
  - Arrays are stored as child tables `<global>_<list>` (`_order`, `_parent_id`, varchar `id`).
  - Scalars are columns on a single row.
- **Migration templates.**
  - `20260826_0_notification_recipients.ts`: parent table, a seeded id=1 row, `setval`.
  - `20260903_0_add_equipment.ts:131-142`: adding a list.
- **Cache.**
  - Recipients use tag `'global:notification-recipients'` (`lib/cache/tags.ts:42`), read through `cached()` in `fetchRecipientLists`.
  - The new global mirrors that with its own tag.
- **Global default.**
  - Model it on `setDefaultCashRegisterAction` (`user-preferences.ts:12-29`, which expires `['users']`).
  - Global variant: a plain `protectedAction` (MANAGER allowed) that validates the id is an existing supplier row and expires the global's tag.
  - The UI mirrors `save-default-register-button.tsx`: a Star/Check toggle, local `useState` seeded from the server, `settleAction`, toast.
- **Phone.**
  - No validation or formatting helper exists.
  - `ContactLink type="phone"` (`components/ui/contact-link.tsx`) renders a `tel:` link.
  - SMS pattern: `src/components/dashboard/sms-test-dialog.tsx` (temporary).
    - `sms:${phone}?&body=${encodeURIComponent(msg)}`, opened via `window.location.href`.
    - `toWhatsAppNumber` normalisation.
- **Address for the SMS.**
  - `siteAddressOf` → `formatAddress` (`src/lib/investments/prefill.ts:25-27`, `format-address.ts:11-13`) appends the country.
  - Pass `''` for the country or add a sibling helper.
  - `InvestmentRefT` carries only `address`. Postal code, city and country come from `fetchInvestmentDetails` (`reference-data.ts:193-235`).

### 3. Order status on the transfer (sibling of `payoutStatus`)

- **The pattern to copy.**
  - Field: `src/collections/transfers.ts:288-299` — a `select` with `access.update: () => false`, readOnly, a `condition`.
  - Constants: `src/lib/constants/payout-confirmation.ts:1-5` (`as const` + type + guard).
  - Migration: `20261011_1_add_payout_confirmation.ts`.
    - Enum `enum_transactions_payout_status` inside a `DO $$ … duplicate_object` guard.
    - The column is nullable, with no default and no backfill.
    - CHECK constraints hold the shape.
- **Stamping — no hook.**
  - `src/hooks/transfers/validate.ts:63-72` stamps `payoutStatus` on create **by type** and strips it
    on update. The order status copies neither.
  - It depends on **which flow created the row**, not the type, so the order flow's create sets
    `awaiting` itself and `validate.ts` stays untouched.
  - No strip on update: the flip is a `payload.update`, and the edit form can't touch the field
    anyway — `updateTransferSchema` whitelists what it writes.
  - A CHECK limiting it to `INVESTMENT_EXPENSE` would break the "user may switch the type" decision. The order may end up as the netto variant or labor-included. Any CHECK must cover every expense type the profiled form can produce, or there should be none.
- **Readers.**
  - Lists come from `payload.find` with `depth: 0` (`src/lib/queries/transfers.ts:35`) and pass through `mapTransferRow` (`transfer-mapping.ts:68,98`). No SELECT list to extend.
  - Types: `TransferRowT` (`src/types/transfers.ts:42`) and the generated `payload-types.ts`.
  - `where-to-sql.ts:19` `FIELD_TO_COLUMN` matters only if the column becomes filterable.
- **The flip.**
  - **Decided 2026-10-19: `payload.update`, not raw SQL** — like `setInvestmentStatusAction`. A
    `protectedAction` expiring `['transfers']`; the transfer hooks run as on any edit.
  - Pass `context: { skipSheetSync: true }` (`sync-sheet.ts:13`): the sheet row doesn't carry the
    status. Optional — sync runs in `after()`, so it never delays the click, and it does nothing for an
    investment without a linked kosztorys (`transfer-sheet-sync.ts:125-131`). Raw SQL saved only that
    one Google write, not worth a second write path.
- **Inline-flip UI.** Model it on `investment-status-inline-select.tsx`:
  - `useOptimistic` + `startTransition` + `settleAction`;
  - implicit rollback, toast on failure.
- **Badge.**
  - Model: `src/components/payouts/payout-status-badge.tsx`.
  - Print text: `lib/transfers/transfer-text.ts:55-69`.
  - Muted tone when `cancelled`.
  - Not clickable on cancelled rows; the actions column already returns null for them (`tables/transfers.tsx:286`).
- **Placement.**
  - Card (`transfer-card.tsx:55-58`): the right slot next to `TransferTypeBadge`, gated `hasColumn(id) && value`. It cannot collide with the payout status, because the two never apply to the same type.
  - Table: a column near the payout columns (`tables/transfers.tsx:200-235`) with `meta.printValue`.
  - New columns are visible by default: column prefs and order ranks are sparse (`column-prefs-storage.ts`, `column-order.ts:5-9`).
- **Unaffected.**
  - The edit form: `updateTransferSchema` whitelists fields.
  - Cancellation copies nothing (`transfers.ts:324-334`).
  - The duplicate finder uses an explicit SELECT.
  - Print and export work through `printValue`.
- **Labels** go in `pl`/`uk`/`ru` (`pl.ts:406-411` neighbourhood). Enum values: `awaiting` / `delivered`.

### 4. `users.phone`

- **Collection:** `src/collections/users.ts:62-129`.
  - Collection update access is `canUpdateUser` (`access/index.ts:34-38`): a MANAGER can update EMPLOYEEs only, an EMPLOYEE nothing.
  - Hooks: `guardUserUpdate` and `makeRevalidateAfterChange('users')`.
- **Form path.** Add the field in each of these:
  - `worker-schema.ts:5-13` / `:17-27` (`z.object` is the whitelist);
  - `worker-form.tsx` `toData` (`:55-65`) + an `AppField` (`:71-119`);
  - `add-worker-dialog.tsx:12` `EMPTY_DEFAULTS`;
  - `edit-worker-dialog.tsx:31-41` `defaultValues`.
- **Actions:** `createWorkerAction` / `updateWorkerAction` (`lib/actions/workers.ts:24-83`) write `parsed.data` whole and revalidate `['users']`. The new field rides through.
- **Read:** `fetchReferenceData` (`reference-data.ts:78-82` SELECT, `:138-153` mapper, `users` tag at `:181`) → `WorkerRefT` (`types/reference-data.ts:70-75`).
  - Optional: show it on `/pracownicy/[id]` (`page.tsx:123-140`).
- **Who edits a phone.** Management, via „Edytuj pracownika”. A MANAGER can edit only EMPLOYEE phones, so a MANAGER-kierownik's phone must be set by ADMIN/OWNER.
  - No own-phone edit exists.
  - Precedent if wanted: `changeOwnLanguageAction` (`account-language.ts:9-25`).
- **Cost.** Every `users` write expires the session-check cache. That is harmless.

### 5. Investment „Kierownik budowy”

- **No user relationship on `investments` today** (`investments.ts:63-245`). `contactPerson` (`:100`) is free text holding the client's contact.
- **FK.** `ON DELETE SET NULL` (`lessons.md:39-40`, descriptive link).
  - Trash only sets `trashed_at`, so reads must check `active` / `trashed_at` themselves.
  - In practice: resolve against `refData.workers` and treat a trashed or inactive match as "no kierownik".
- **Picker:** `refData.workers.filter(isActiveRef)`.
  - `refData.workers` holds all roles and excludes trashed accounts (`splitTrashed`, `reference-data.ts:47-51`).
  - Precedents: `line-items-field.tsx:135`, `stage-split-dialog.tsx:62`.
- **Form path.** Add the field in each of these:
  - `investment-schema.ts:21-35` / `:39-59`;
  - `investment-form.tsx` (`toData` at `:122` spreads the whole value; contact fields at `:169-181`);
  - `add-investment-dialog.tsx:28`;
  - `edit-investment-dialog.tsx:12-27` `Pick` + `:56-70` `defaultValues`.
- **⚠ Notes-save trap.**
  - `investment-notes.tsx:38-48` calls `updateInvestmentAction` with a partial record.
  - `investmentSchema` defaults missing keys, which already blanks postalCode/city/country today.
  - A kierownik key defaulting to null would be wiped on every notes save.
  - Fix options:
    - (a) the notes save passes the kierownik;
    - (b) the update drops keys that are absent;
    - (c) the notes save gets its own action.
  - `lessons.md:537` is the same class of bug, fixed for `aiStage` with its own action.
- **Reads.**
  - Add the id to the investments SELECT (`reference-data.ts:70`) → `InvestmentRefT` (`types/reference-data.ts:23-37`) and `InvestmentRowT` (`table-rows.ts:10-51`, via `shape-investments.ts:74-80`).
  - Resolve name and phone from `refData.workers`.
  - Both reads are already tagged `investments` + `users`, so no new tag is needed.

### 6. Button placement

- **Investment page.**
  - The button row is at `inwestycje/[id]/page.tsx:72-82`, mostly behind `!trashed`.
  - The page is behind `requireManagementPage()` (`:39`).
  - It already fetches `referenceData` and `fetchInvestmentDetails` (`:56-62`).
- **List „Akcje”** (`components/tables/investments.tsx:304-318`).
  - The role comes via `getInvestmentColumns({ userRole })` (`:81-88`) from `useCurrentUser()` (`investment-data-table.tsx:49`).
  - The page is behind `requireAuth(MANAGEMENT_ROLES)` (`inwestycje/page.tsx:11`).
- **Phone (390px):** out of scope per AGENTS.md. The order is a desktop management flow.

### 7. Migrations

- **Naming and registration.** Latest: `20261018_1_…`. Name format: `YYYYMMDD_N_snake.ts`. Each one is registered in `src/migrations/index.ts` (import + `{ up, down, name }`).
- **Changes needed:**
  - `users.phone` — `varchar`, nullable (pattern: `20261009_3_worker_expense_without_investment.ts`).
  - `investments.site_manager_id` — integer FK `ON DELETE set null` + index (pattern: `20260904_0_equipment_event_author.ts:14-21`).
  - `transactions.order_status` — enum (pattern: `20261011_1_add_payout_confirmation.ts`, `20261012_0_add_investment_ai_stage.ts`).
  - The settings global — parent row + suppliers child table (pattern: `20260826_0_notification_recipients.ts`).
- **Deploy order.** All are additive, so prod is migrated by a human before the push.

## Code References

- `src/components/forms/expense-form/expense-form.tsx:207-215` — `blankValues`, the replacement point for profiled initial values
- `src/lib/actions/transfers.ts:128-247` — `createBulkTransferAction`; returns no ids; `decideExpenseParagons` on draft id
- `src/components/dialogs/expense-dialog.tsx` — the only mount of the expense form (top nav)
- `src/components/tables/investment-data-table.tsx:74-80` — row-dialog `useState` precedent (`onSettle`)
- `src/components/dialogs/edit-investment-dialog.tsx:81-88`, `review-prompt-store.ts`, `(frontend)/layout.tsx:104` — dialog chaining after save
- `src/collections/transfers.ts:288-316` — `payoutStatus` + sibling fields to mirror
- `src/hooks/transfers/validate.ts:63-72` — how `payoutStatus` is stamped/stripped (not copied for the order status)
- `src/lib/actions/payout-confirmation.ts:22-23` — why transfer rows expire `['transfers']`, not entity tags
- `src/lib/actions/investments.ts` `setInvestmentStatusAction` — the `payload.update` flip to mirror
- `src/hooks/transfers/sync-sheet.ts:13,20` — `skipSheetSync` flag; sync runs in `after()`
- `src/hooks/transfers/sync-sheet.ts:12-28` — why the flip must not be `payload.update`
- `src/components/investments/investment-status-inline-select.tsx` — optimistic inline flip
- `src/components/payouts/payout-status-badge.tsx`, `src/components/transfers/cards/transfer-card.tsx:55-58`, `src/components/tables/transfers.tsx:200-235,286` — badge, card slot, column, cancelled-row guard
- `src/lib/queries/transfers.ts:35,52-53` — `payload.find` rows, `transfers` cache tag
- `src/globals/notification-recipients.ts`, `src/lib/actions/notification-recipients.ts` — global + read-modify-write save
- `src/components/forms/form-fields/save-default-register-button.tsx`, `src/lib/actions/user-preferences.ts:12-29` — default toggle pattern
- `src/components/dashboard/sms-test-dialog.tsx` — `sms:` link pattern (temporary)
- `src/lib/investments/prefill.ts:25-27`, `format-address.ts:11-13` — address formatting (appends country)
- `src/lib/queries/reference-data.ts:47-51,69-82,117-153,181,193-235` — investments/users reads, trashed split, details
- `src/components/investments/investment-notes.tsx:38-48` — partial-record save that wipes absent keys
- `src/components/forms/investment-form/investment-schema.ts:21-59`, `investment-form.tsx:122,169-181` — investment form path
- `src/components/forms/worker-form/worker-schema.ts:5-27`, `worker-form.tsx:55-119` — worker form path
- `src/lib/utils/is-active-ref.ts:1` — active filter for pickers
- `src/components/tables/investments.tsx:81-88,304-318` — „Akcje” column
- `src/app/(frontend)/inwestycje/[id]/page.tsx:39,56-62,72-82` — investment page reads and button row

## Architecture Insights

- **"Stamped by flow, not by type"** is new for transfers.
  - Every existing status (`payoutStatus`) is derived from the type in the validate hook.
  - The order status is the first one set by the *creating surface*, so it bypasses the validate hook
    entirely: set on create by the order flow, flipped by a plain `payload.update`.
- **A full-record form save + schema defaults** silently resets any field the caller omits. That is the `aiStage` lesson. A new field in a form schema owes a sweep of every partial caller.
- **Hidden globals edited inline on the page that uses them** (no settings page) is the established settings pattern.
- **Sheet sync on a transfer update is cheap to trigger:** it runs in `after()` and exits early without
  a linked kosztorys. A UI-only flag goes through `payload.update` + `skipSheetSync`, not a raw-SQL
  write path.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:39-40` — SET NULL for descriptive FKs.
- `context/foundation/lessons.md:537` — a hand-set investments label stays out of `investmentSchema` (the `aiStage` overwrite). The same class of bug applies to the kierownik via the notes save.
- `20261011_1_add_payout_confirmation.ts` — the payout-confirmation change set the enum + CHECK + raw-UPDATE pattern reused here.

## Related Research

None for this feature.

## Open Questions

All resolved 2026-10-19 (owner decisions for 1, 5–8; technical calls for 2–4):

1. ~~Category/sub-category resolution~~ — **decided**: case-insensitive name „contains”; no match →
   empty field, the user picks it.
2. ~~How the order status reaches the row~~ — **decided**: the bulk create action accepts an order
   flag and stamps `awaiting` on the rows it creates — one write, no partial state.
3. ~~Quantity storage~~ — **decided**: in the description only („2 × big bag”); no column. Nothing
   reads a quantity back, and the SMS is composed from the form before it closes.
4. ~~Investments list data~~ — **decided**: the list page fetches `referenceData` itself; it is
   already `cached()`, so a lazy loader would add a mechanism for no gain.
5. ~~No-invoice confirm~~ — **decided**: unchanged. An order shows the „brak faktury” confirm like
   any expense; skipping it would need an order-only branch in the form.
6. ~~Locked investments~~ — **decided**: the order button is hidden on a locked investment (page and
   „Akcje”), mirroring `isOfferedForBooking`.
7. ~~Settings editor placement~~ — **decided (provisional)**: a „Zamówienia big bag / kontener” card on
   `/inwestycje` — suppliers (name + phone) and both prices; visible to management, edited by
   ADMIN/OWNER. The owner may move it after seeing it.
8. ~~SMS address line~~ — **decided**: „Adres: …” under the ordered items, from the investment's
   street, postal code and city (no country).
9. ~~Notes-save fix~~ — **resolved 2026-10-19**: the notes save now goes through its own
   `setInvestmentNotesAction`, which writes `notes` alone. It was also blanking postal code, city and
   country on every note save since 2026-10-16.
