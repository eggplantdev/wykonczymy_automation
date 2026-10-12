---
date: 2026-10-11T20:52:10+02:00
researcher: Claude (Opus 5.5)
git_commit: 14b36b922a6e4f0c9d344b2a128d7a17a827c659
branch: staging
repository: wykonczymy
topic: 'Worker confirms or rejects a wypłata — status, acceptance date, rejection reason, a „Wypłaty” page'
tags: [research, codebase, transfers, payout, worker-page, sheets-sync, i18n]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
---

# Research: Worker confirms or rejects a wypłata

**Date**: 2026-10-11T20:52:10+02:00
**Git Commit**: 14b36b922
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Management books a wypłata (`PAYOUT`); the worker confirms the amount on his own `/pracownicy/[id]`
or rejects it with a required reason. Management sees status, acceptance date and reason on a new
„Wypłaty” list page. What exists today, what must change, and what does a pending wypłata do to the
figures? (Scope as stated by the user lives in `change.md`.)

## Summary

1. **The status must be a label, not a gate on any figure.** A PAYOUT is cash that has already left
   a kasa (`sum-transfers.ts:26-55` subtracts it from `source_register_id`; nothing credits a
   worker). Of the 38 active EMPLOYEE accounts holding wypłaty in the local dump, only 7 have a live
   session, and about half the worker e-mails are placeholders, so many workers cannot log in to
   confirm at all. A pending wypłata excluded from the kasa balance, „Pozostało do wypłaty” or marża
   v1 would make those figures wrong indefinitely. Kept as a label, **none of the 9 raw-SQL readers
   and 3 Payload-Where readers that select PAYOUT rows change**, the golden master and render-parity
   specs stay green, and the sheet sync is untouched.
2. **This inverts the worker-expense precedent, and the reason is stated.** Expense drafts live in a
   separate table because "one missed filter and a draft moves the balance"
   (`context/archive/2026-10-05-worker-expenses/change.md:54-57`). That argument applies to a status
   that _gates_ figures. A label gates nothing, so it can sit on `transactions` safely.
3. **Existing wypłaty must not be backfilled as „accepted”.** Lesson „A backfill may not write a
   terminal status for an effect it never performed” (`lessons.md:1079`): no worker accepted them.
   They keep `NULL` = "booked before confirmations", which the page renders as „—”.
4. **The worker's decision is a single raw-SQL `UPDATE`, not `payload.update`.** Through Payload it
   would run `validateTransfer`, which refuses any write on a locked (completed) investment
   (`hooks/transfers/validate.ts:67-80`), and re-fire the sheet sync. The decision is acknowledgment,
   not a money change, so it belongs in `src/lib/db` with an ownership + race guard in the
   `WHERE`, behind a `sessionAction`, mirroring `deleteExpenseDraftAction`.
5. **The page is the transfers table with the type fixed to `PAYOUT`**, following
   `kasa/[id]/page.tsx:40-45`, plus a status filter and three columns. That keeps „Anuluj” on each
   row, which a rejected wypłata needs. The queue page `/zgloszenia-wydatkow` is the template for the
   status badge and the status filter, not for the table.

## Detailed Findings

### How a PAYOUT is booked and changed

- Spec: `src/lib/constants/transfers.ts:235-245` — `financialBucket: 'payouts'`,
  `sourceRegister: 'required'`, `transfersSheetTab: true`. Worker required (`needsWorker` `:567`);
  investment optional.
- Booking paths (management only; MANAGER included — `canBookTransferType` restricts only BONUS,
  `lib/auth/roles.ts:25-26`):
  - „Wydatek” → `ExpenseForm` → `createBulkTransferAction` (`lib/actions/transfers.ts:105-212`).
  - „Rozlicz wypłaty” → `settlePayoutsAction` (`lib/actions/settle-payouts.ts:37-125`), mounted on
    `/pracownicy`, the investments listing and the kosztorys summary.
  - `createTransferAction` (`transfers.ts:42-87`) accepts a PAYOUT but no form sends one.
  - Dev seed `src/scripts/seed-worker-payouts.ts:106` writes raw SQL.
- After booking, amount, worker and source kasa are frozen (field access `update: () => false`;
  `updateTransferSchema` `lib/schemas/transfer.ts:51-72`). Editable: description, date, investment,
  otherCategory, invoice fields (`updateTransferAction` `transfers.ts:297-375`).
- Cancel: `cancelTransferAction` (`transfers.ts:249-295`) — `cancelled: true` + a `CANCELLATION`
  row. A MANAGER may cancel only a PAYOUT he created (`canMutateTransfer`, `roles.ts:55-65`).
- Hooks on `transactions` (`collections/transfers.ts:79-84`): `validateTransfer` (lock refusal,
  required fields), `recalcAfterChange` (revalidates `collection:transactions` + entity tags),
  `syncSheetAfterChange` (sheet row in `after()`).
- No e-mail or push on any transfer path. The only outgoing effect is the owner's sheet.

### Every reader of PAYOUT amounts (unchanged under a label status)

No shared predicate exists; each reader filters `cancelled IS NOT TRUE` inline.

| Figure                                           | Reader                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kasa balances                                    | `sum-transfers.ts:49-51, 75-77` → `fetchRegisterBalances`, `getRegisterBalance`                                                                       |
| Investment financials, marża v1, listing columns | `sum-transfers.ts:115-124` (listing), `:252-285` (`sumFilteredByType`) → `deriveFinancials` `investment-financials.ts:110`                            |
| „Pozostało do wypłaty” — pair source (B)         | `worker-payout-pairs.ts:46-54` → /pracownicy column, settle dialog + staleness re-check, `book-overpayment-bonus.ts:55`, listing `subcontractorsOwed` |
| „Pozostało do wypłaty” — row source (A)          | `get-payout-transactions.ts:23-30` → Podwykonawcy tab, worker link `(share)/z/…`, worker PDF                                                          |
| Transfers list / export / sheet                  | `transfer-filters.ts:88`, `export-transfers.ts:46`, `sheets-sync.ts:139, 369`                                                                         |

- Investor surfaces (bilans, share link `k/[token]`, protokół) never read payouts
  (`calculate-balance.ts:12-21`).
- Specs pinning these: `financial-golden-master-db.test.ts:313`,
  `investment-render-parity-db.test.ts:240-253` (A and `sumFilteredByType` must agree),
  `lib/db/worker-payout-pairs.test.ts`.
- If a later ruling makes pending gate a figure, every row of the table needs its own clause and
  the parity spec breaks the moment (A) and (B) disagree — that is the cost a label avoids.

### Workers and accounts

- The PAYOUT `worker` is a `users` row (`collections/transfers.ts:207-215`); an EMPLOYEE logging in
  is the same entity, so "his wypłaty" = `worker_id = ctx.user.id`.
- Local dump, non-cancelled PAYOUTs: 57 with no worker (legacy, March–April), 19 booked to MANAGER /
  OWNER accounts, 184 to 7 EMPLOYEEs with a live session, 435 to 25 EMPLOYEEs without one, 25 to 6
  inactive EMPLOYEEs.
- Placeholder e-mails ~24/49 (`archive/2026-10-05-worker-account/change.md:97-99`); first password
  only via „Zapomniane hasło” (`:101-104`). Owner: „części pracowników trzeba będzie obsłużyć bez
  logowania” (`:84-85`). Workers open the app every 2–4 weeks
  (`archive/2026-10-07-worker-pwa-install-and-long-session/change.md:14`).

### Worker side — patterns to reuse

- Page: `src/app/(frontend)/pracownicy/[id]/page.tsx`; gate `canViewWorkerPage` (`:45-51`),
  `isOwnPage` (`:57`). Sections: quick actions, kasy, sprzęt, investments, expense drafts, reports,
  transfers (`:142-208`). The EMPLOYEE's transfers table has no `actions` column (`:190-192`).
- Pending-first section precedent: `WorkerExpenseDraftsSection` → `worker-expense-drafts-table.tsx`
  (default filter `['pending']` `:30`, actions only on pending rows `:72-90`), uncached fetch
  (`lib/queries/worker-expense-drafts.ts:20-26`).
- EMPLOYEE-callable action: `sessionAction` (`lib/actions/run-action.ts:84-95`) — "handler must
  scope the work to `ctx.user`". Precedent `deleteExpenseDraftAction`
  (`lib/actions/worker-expense-drafts.ts:174-184`) with ownership + state in SQL:
  `WHERE id = … AND worker_id = … AND status = 'pending'` (`lib/db/worker-expense-drafts.ts:580-596`).
  The same `WHERE … status='pending'` is the race guard in `decideExpenseDraft` (`:373`).
- Reject dialog: `src/components/transfers/cancel-transfer-button.tsx` — required reason textarea,
  `CANCEL_REASON_MIN_LENGTH` / `MAX_LENGTH` (`lib/schemas/transfer.ts`), live counter, confirm
  disabled until valid. Its copy is hard-coded Polish; the worker's must be translated.
- Translations: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`, `uk`/`ru` typed `TranslationsT` so a
  missing key fails typecheck. Namespace `workerPage`; status labels follow
  `DRAFT_STATUS_LABEL_KEYS` (`lib/constants/worker-expense-drafts.ts:11-15`). ~90% of the crew is
  Ukrainian. Never translate through `lib/constants/transfers.ts` label maps (AGENTS.md).
- A worker has no nav and no unread counts (`use-nav-links.ts:19`, `unread-counts.ts:25`), so "N
  wypłat do potwierdzenia" lives on his page, not in the menu. The app-icon badge is EX-1040.

### Management side — the „Wypłaty” page

- Template: `kasa/[id]/page.tsx:40-45` (strip a URL param, `buildTransferFilters`, add a fixed
  clause) → `TransfersSection` → `TransferTableServer` → `TransferDataTable`
  (`components/transfers/*`, config `transfer-table-config.ts:12-42`). Fix `where.type = PAYOUT`,
  omit `transferTypes` from filters, `excludeColumns: ['type']`.
- Missing: a status filter in `TransferFilters`, status / decision date / reason columns in
  `getTransferColumns` (`components/tables/transfers.tsx:232`), sort whitelist entries in
  `SERVER_SORTABLE_TRANSFER_COLUMNS` (`lib/transfers/sortable-columns.ts:6-24`).
- Status badge: copy `DraftStatusBadge` (`components/worker-expenses/draft-status-badge.tsx:11-24`,
  `BADGE_TONE` in `components/ui/badge.tsx:5-13`).
- Route plumbing: `PAGE_TITLES.payouts` (`lib/constants/sections.ts:24-38`), `NAV_LINKS` entry
  (`:48-71`), `loading.tsx` with `TitledPageLoading`, guard `requireManagementPage()`
  (`lib/auth/require-management-page.ts:13-17`). Optional nav count via `unreadStream`
  (`types/notifications.ts`, `lib/queries/unread-counts.ts:23-39`) — e.g. rejected awaiting action.
- Cache: the list is `findTransfersRaw` under `CACHE_TAGS.transfers`; the worker's action must
  expire that tag (`updateTag`) so the page shows the decision immediately.

### Schema

- `transactions` has no status column; only `cancelled` and `settled` booleans.
- Template migration for a select field: `20260721_1_add_vat_plane_to_transactions.ts` (enum in a
  `DO $$ … duplicate_object` block + nullable column). Raw-table precedents use `text` + `CHECK`
  (`20260930_2_add_worker_reports.ts:12,23`). Latest migration `20261009_4_kosztorys_stages_completed`;
  register in `src/migrations/index.ts`, then `pnpm generate:types`. Additive → prod migrated before
  the push (human).
- Columns needed: status (`pending` | `accepted` | `rejected`, nullable for history and non-PAYOUT
  rows), decision timestamp, rejection reason. An invariant like the drafts' `decided_check`
  (`20261005_3_add_worker_expense_drafts.ts:20`): pending ⇔ decision timestamp null.

## Code References

- `src/lib/constants/transfers.ts:235-245` — PAYOUT spec
- `src/lib/actions/transfers.ts:105-212, 249-295` — bulk booking, cancel
- `src/lib/actions/settle-payouts.ts:37-125` — „Rozlicz wypłaty”
- `src/hooks/transfers/validate.ts:67-80` — locked-investment refusal (reason for a raw-SQL decision)
- `src/lib/db/sum-transfers.ts` — kasa balances and investment sums
- `src/lib/db/worker-payout-pairs.ts:46-54`, `src/lib/db/get-payout-transactions.ts:23-30` — „Pozostało” sources
- `src/lib/actions/run-action.ts:84-95` — `sessionAction`
- `src/lib/db/worker-expense-drafts.ts:373, 580-596` — ownership + race guard precedent
- `src/components/transfers/cancel-transfer-button.tsx` — reason dialog to share
- `src/app/(frontend)/kasa/[id]/page.tsx:40-45` — fixed-scope transfers page template
- `src/app/(frontend)/pracownicy/[id]/page.tsx:142-208` — worker page sections

## Architecture Insights

- **Label vs gate decides the blast radius.** A status that gates a figure needs a clause in ~12
  independent readers with no compiler help; a label needs none. Same shape as the lesson „Status
  inwestycji to etykieta, nie bramka” (`lessons.md:1727`), applied deliberately here.
- **Booking and acknowledging are two planes.** Booking is management's money decision
  (Payload write, hooks, sheet); acknowledging is the worker's statement about it (one raw `UPDATE`,
  no hooks). Keeping them apart is what lets a worker confirm on a locked investment.
- **Which new PAYOUTs start `pending`** is a rule on the booking side: only a worker who can
  actually answer should be asked, otherwise the page fills with rows that never move.

## Historical Context (from prior changes)

- `archive/2026-10-05-worker-expenses/change.md:43, 54-57` — czeka / przyjęty / odrzucony; separate
  table so a draft can't move a balance.
- `archive/2026-09-29-worker-payout-remaining/change.md:21-69` — grain is investment × worker; no
  netting; „Rozlicz wypłaty” refuses on moved figures; visible to MANAGER.
- `archive/2026-10-05-worker-account/change.md:59-67, 84-85` — worker sees `worker = him` OR his
  kasy (combined with `and`, never spread); a token-only path stays for workers without login.
- `archive/2026-10-02-premia/change.md` — BONUS is a separate non-cash type; it needs no
  confirmation under this change.
- No prior decision about a worker confirming or disputing a wypłata exists in `context/` or git.

## Related Research

- `context/changes/2026-10-11-pwa-push-notifications/change.md` — EX-1040, blocked by this change.
- `context/changes/2026-10-11-investment-transactions-page/` — `TransferDataTable` / filters only
  work on a route page, not inside a tab.

## Open Questions

Owner questions 1–3 are answered — rulings recorded in `change.md`. 4 and 5 keep the defaults.
Queue precedent for ruling 3: `UnreadStreamT` queue streams `workerReports` / `expenseDrafts`
(`types/notifications.ts:1`, `components/nav/unread-badge.tsx:16`, `lib/constants/sections.ts:63-71`)
and the pinned dashboard block with „Zweryfikuj” (`components/worker-expenses/open-expense-draft-button.tsx`,
`components/dashboard/manager-dashboard.tsx:40-57`).

For the owner (as asked):

1. **Does a wypłata waiting for confirmation count in the figures?** Recommended: yes, everywhere —
   the cash has left the kasa; the status only says whether the worker agreed.
2. **Who gets asked?** Every new wypłata to an EMPLOYEE, or only to workers who have an account they
   can log in to? Wypłaty to MANAGER / OWNER accounts and to workers without a login would otherwise
   wait forever.
3. **What happens after a rejection?** Management reads the reason and then cancels and rebooks,
   or the row just stays „odrzucona” as a record. Can the worker change his mind (rejected →
   accepted)?
4. **Old wypłaty** stay without a status („—”), not „zaakceptowana” — confirm.
5. **Does the status go to the owner's sheet?** Default: no, the sheet row is unchanged.

For the plan:

- Share the reason field between `cancel-transfer-button.tsx` and the reject dialog.
- Does a management edit after a decision (date, investment) reset the status? Amount and worker
  cannot change, so default: no.
- Where the worker's pending block sits on his page (pinned above quick actions vs its own
  section) — phone, 390px.
- New test-plan risk: a worker decides a wypłata that is not his (ownership in the `WHERE`).
