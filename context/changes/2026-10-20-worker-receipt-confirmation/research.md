---
date: 2026-10-20T14:50:11+02:00
researcher: Claude
git_commit: 8d60d7f82
branch: staging
repository: wykonczymy
topic: "Extend the wypłata confirmation flow to money booked into a worker's kasa"
tags: [research, payout-confirmation, push, cash-registers, transfers]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude
---

# Research: Extend the wypłata confirmation flow to money booked into a worker's kasa

**Date**: 2026-10-20T14:50:11+02:00
**Researcher**: Claude
**Git Commit**: 8d60d7f82
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does it take to give a Transfer między kasami into a worker's kasa, and an Inna wpłata /
Wpłata od inwestora / Zasilenie z konta firmowego booked into one, the same pending → accepted |
rejected confirmation, push and badge, and management notification a wypłata has — and how do we
know who must confirm a row that has no `worker_id`?

## Summary

The flow's back half is generic: the decision UPDATEs, the status columns' own CHECKs, the
management queue (`AWAITING_MANAGEMENT`), the nav badge stream, `sendPushToUser`, `public/sw.js`,
the status column/filter/card slot and `canCancelTransfer` all key on `payout_status`, not on the
type. PAYOUT and `worker_id` are hard-coded in five places:

1. the DB CHECK `transactions_payout_status_only_on_payout` and `carriesPayoutStatus` (type gate);
2. **who decides** — `DECIDABLE`, `listPayoutsToConfirm`, `countPendingPayouts` key on
   `worker_id = me AND type = 'PAYOUT'`;
3. the create-time push gate `carriesPayoutStatus(type) && worker` in `createTransferAction`;
4. the management table's „Pracownik" (joins `worker_id`) and „Kasa" (source only);
5. copy — 12 of the 34 dictionary keys and the hard-coded strings in `rejected-payouts.tsx` say
   „wypłata", 4 more are feminine-gendered to agree with it.

**Recipient resolution: derive it from the kasa owner, don't store it.** The owner of a kasa with any
live transaction cannot change (`guard-update.ts:44-49`, since 2026-09-30), registers and amount of
these types can't be edited after booking, and a kasa that ever received money can't be trashed. The
worker page already scopes his transfers by current kasa ownership. The one mutable input — the
owner's **role** — only matters for the question „does this booking need confirmation", and that is
answered once, at create, by stamping `payout_status = 'pending'`. Reusing `worker_id` instead would
leak the worker into the „Pracownik" column, the `?worker=` filter and the sheet's „Pracownik" cell
for INVESTOR_DEPOSIT.

Size: 23 qualifying bookings in the last 30 days (22 transfers, 1 investor deposit), 14 distinct
workers. Every one was booked by management; zero self-transfers.

## Detailed Findings

### Who can receive money, and through which path

- `createTransferAction` (`src/lib/actions/transfers.ts:55-107`, `protectedAction`) is the only
  UI path for all four types: `deposit-form.tsx:104` (deposits; `COMPANY_FUNDING` hidden from
  non-ADMIN/OWNER at `:57-58`) and `internal-transfer-form.tsx:63-72` (REGISTER_TRANSFER, both kasy
  from the full `referenceData.cashRegisters`).
- Bulk create (`:129-251`) offers only `TRANSACTION_TRANSFER_TYPES` in the UI (`expense-form.tsx:380`);
  its schema accepts any type (`bulk-expense-schema.ts:108`), so these four are reachable only by a
  hand-made call. The hook stamps the status on every path anyway.
- Edit (`updateTransferAction :352-433`): no type, register or amount field for these types
  (`schemas/transfer.ts:38-55`); amount edits are LABOR_COST only (`:411-422`). Field access:
  amount `:96`, type `:131`, sourceRegister `:161`, targetRegister `:171` are `update: () => false`.
- Cancel (`:296-350`) marks `cancelled`, which every confirmation query already filters out. No
  push or badge refresh on cancel — the icon badge corrects on the next app open
  (`push-subscription-sync.tsx`).
- No prod script writes transactions; seeds are wired to the test DB.

**Trigger (user, 2026-10-20): any booking that puts money into an EMPLOYEE-owned kasa** — no type
list, no booker-role condition. The balance rule (`src/lib/db/sum-transfers.ts:25-44`) defines
"money in": a deposit type on `source_register_id`, a `REGISTER_TRANSFER` on `target_register_id`,
and — the one non-obvious case — a `CORRECTION` (always negative) on `source_register_id`, which the
`-amount` branch turns into a raise. 9 live CORRECTIONs sit on employee kasy, all invoice refunds
(e.g. 2026-10-13, −49,98 zł „Castorama 12.10.2026", Kasa - Jura). Cancelling an expense also restores
the balance, but by dropping the original row (`cancelled IS NOT TRUE`), not by a new booking.

### Recipient: the kasa owner

- `cash_registers.owner` is required and single (`src/collections/cash-registers.ts:48-53`).
- `guardCashRegisterUpdate` (`src/collections/hooks/cash-registers/guard-update.ts:44-49`) refuses an
  owner change while `cashRegisterDeleteBlocker` (`src/lib/cash-registers/delete-blocker.ts:7-25`)
  finds a non-cancelled transaction or a pending draft. Loophole: a kasa whose only transactions are
  cancelled — irrelevant here, a cancelled row is never decidable.
- A worker with a used kasa can't be trashed (`src/lib/workers/trash-worker.ts:12-42`). Deactivation
  deletes his sessions and push subscriptions (`account-removal.ts:51-54`); his kasa stays his.
- The owner's role is mutable (`updateWorkerAction`, `src/lib/actions/workers.ts:44-80`).
- 29 EMPLOYEE-owned kasy: 21 `WORKER`, 8 `AUXILIARY`; all 8 look personal (Nikolajewicz, Valerii,
  Paweł AEŚ, …). One employee owns two (Mikolaj Hulko, #18 inactive + #38). Kasa #43 „Andrii
  Elektryk" is owned by the OWNER although an EMPLOYEE Andrii exists — neither approach catches it.
- For a deposit, `validateSourceRegister` (`validate-source-register.ts:17-33`) already returns
  `ownerId` (not the role); the target kasa of a REGISTER_TRANSFER isn't looked up in the action.

### What reads `transactions.worker_id` (why not to reuse it)

- Money readers all filter `type IN ('PAYOUT','BONUS')` (`worker-payout-pairs.ts:37-45`,
  `get-payout-transactions.ts:19-25`) — no figure would move.
- Unfiltered readers that would change: the „Pracownik" column/chip
  (`transfer-mapping.ts:89,111` → `tables/transfers.tsx:178-182`, `transfer-card.tsx:97-99`), the
  `?worker=` filter (`transfer-filters.ts:126-129`, offered on `/inwestycje/[id]` and `/kasa/[id]`),
  the sheet „Pracownik" cell for INVESTOR_DEPOSIT (`google/tab-rows.ts:90`), and the worker delete
  blocker (`workers/delete-blocker.ts:13`).
- `validate.ts:164-166` nulls `worker` on every type where `showsWorker` is false; field access at
  `collections/transfers.ts:199` blocks updating it.

### The confirmation mechanism, piece by piece

**Schema** — `src/migrations/20261011_1_add_payout_confirmation.ts`: enum `:12`, three nullable
columns `:16-19`, no default, no backfill (785 old PAYOUTs `NULL`). CHECKs: `:22-23`
`payout_status IS NULL OR type = 'PAYOUT'` (**hard-coded**); `:24-29` decided-at/reason CHECKs are
type-agnostic. No index on `payout_status`.

**Stamp on create** — `src/collections/hooks/transfers/validate.ts:65-73`:
`d.payoutStatus = carriesPayoutStatus(type) ? 'pending' : null`; update deletes all three keys.
`carriesPayoutStatus` (`src/lib/constants/transfers.ts:386`) is `type === 'PAYOUT'`, also read by the
Payload admin conditions (`collections/transfers.ts:289-318`), `transferPayoutStatusText`
(`transfer-text.ts:55-61`) and the notify gate. Registers are resolved at `:54/:56`, and the hook
already opens `getDb` (`:80/:108`), so an owner-role lookup fits here.

**Decisions** — `src/lib/db/payout-confirmation.ts`:
- `DECIDABLE :36-38` `id AND worker_id = $me AND type = 'PAYOUT' AND cancelled IS NOT TRUE` —
  ownership lives in the WHERE (test-plan risk #27: „its WHERE is the whole gate").
- `acceptPayout :41-52` / `rejectPayout :54-66` inherit it; bodies are generic.
- `listPayoutsToConfirm :68-90` and `countPendingPayouts :92-99` — **hard-coded**. `PayoutToConfirmT`
  (`:7-15`) has no type, kasa or sender.
- `AWAITING_MANAGEMENT :101`, `REJECTED_PAYOUTS_COUNT :103-105` — generic.
- `listRejectedPayouts :107-137` — generic filter, but joins `users w ON w.id = t.worker_id`
  (kasa rows → `workerId 0`, empty name) and only `source_register_id`.
- Actions (`src/lib/actions/payout-confirmation.ts:25-55`, `sessionAction`) pass `ctx.user.id`;
  they expire `['transfers']` — already right for these rows.
- `fetchOwnPendingPayoutCount` (`src/lib/queries/pending-payouts.ts:11-15`) feeds `syncAppBadge`.

**Push** — `src/lib/push/notify-pending-payouts.ts`: `BookedPayoutT = { workerId, amount }`,
summed per worker, badge = `countPendingPayouts`, `tag: 'payout-pending'`,
`url: /pracownicy/${workerId}`, copy `workerPage.payoutPushTitle/Body`. `PushTagT`
(`send-push.ts:15`) doubles as the push-service `topic` (≤32 chars; same topic collapses
undelivered messages). Call sites: `transfers.ts:96-101` (gated `carriesPayoutStatus && worker` —
**never fires for these types**), `:240-244` (bulk), `settle-payouts.ts:117`. `public/sw.js:59-103`
and `sendPushToUser` are generic. `PAYOUT_PUSH_PAUSED` (`push/constants.ts:2`, now `false`) gates only
`notifyPendingPayouts`.

**UI**
- Worker: `payouts-to-confirm.tsx:24-156` (heading = investment name or „Bez inwestycji" — wrong for
  a transfer), `reject-payout-dialog.tsx:22-78` (generic but copy). Worker page `page.tsx:95,168`,
  `:208` `showPayoutStatusFilter: transferTypes.includes('PAYOUT')` (**hard-coded**). His transfer
  scope (`worker-transfers.ts:5-33`) already includes rows into his kasy.
- Management: `rejected-payouts.tsx:15-105` on „/" (`manager-dashboard-panels.tsx:11-21`), Polish
  hard-coded („Wypłaty odrzucone przez pracowników", „Pracownik" linking `worker_id`). Nav badge on
  „Transakcje" via stream `rejectedPayouts` (`sections.ts:48-53`, `shell-badge-counts.ts:25`).
- Generic: `payout-status-badge.tsx`, status/decision-date/reason columns
  (`tables/transfers.tsx:184-221`), card slot (`transfer-card.tsx:57`), filter
  (`transfer-filters.tsx`, `transfer-filters.ts:113-118`), `where-to-sql.ts:19`, sorting, mapping.
- `canCancelTransfer` (`roles.ts:84-90`) keys on `payoutStatus === 'rejected'` — carries over.

**i18n** — 34 keys × pl/uk/ru (`pl.ts:50-52, 115-133, 142-143, 422, 428-439`). Wypłata-specific:
`payoutAlreadyDecided`, `payoutsTitle`, `rejectedPayoutsTitle`, `rejectedPayoutsHint`,
`payoutAcceptTitle`, `payoutAccepted`, `payoutRejectTitle`, `payoutRejected`, `payoutPushTitle`.
Feminine agreement: `payoutStatus_accepted` „Potwierdzona", `payoutStatus_rejected` „Odrzucona",
`payoutCancelled` „Anulowana". Generic enough: `payoutsHint`, `payoutAcceptDescription`,
`payoutPushBody` „Potwierdź odbiór {{amount}}.", the reason keys.

### Tests that will break or need extending

- **Break**: `__tests__/lib/actions/transfers.db.test.ts:298,306` (INVESTOR_DEPOSIT and
  REGISTER_TRANSFER persist `payout_status: null`); `__tests__/lib/constants/transfers.test.ts:161-163`
  (`carriesPayoutStatus` true only for PAYOUT).
- **Extend**: `collections/hooks/transfers/payout-status-default.db.test.ts` (pending per new type,
  EMPLOYEE vs management owner), `lib/db/payout-confirmation.db.test.ts` (kasa-owner ownership in every
  query — risk #27), `lib/push/notify-pending-payouts.test.ts`, `lib/push/push-client.test.ts`
  (combined count), `lib/transfers/transfer-text.test.ts`, `lib/auth/roles.test.ts`.
- No E2E covers the flow; push is a production-only manual check (`manual-checks.md:376-399`).

## Code References

- `src/migrations/20261011_1_add_payout_confirmation.ts:22-23` — the PAYOUT-only CHECK
- `src/lib/constants/transfers.ts:386` — `carriesPayoutStatus`
- `src/collections/hooks/transfers/validate.ts:65-73` — status stamped on create, stripped on update
- `src/collections/hooks/transfers/validate.ts:164-166` — worker nulled on non-worker types
- `src/lib/db/payout-confirmation.ts:36-38,68-99,107-137` — ownership and the PAYOUT-only queries
- `src/lib/actions/transfers.ts:96-101` — the create-time push gate
- `src/lib/push/notify-pending-payouts.ts:10-33` — per-worker push, PAYOUT badge count
- `src/collections/hooks/cash-registers/guard-update.ts:44-49` — owner locked once the kasa is used
- `src/lib/queries/worker-transfers.ts:5-33` — worker page scope by kasa ownership
- `src/components/payouts/rejected-payouts.tsx:15-105` — management table (worker_id join)
- `src/app/(frontend)/pracownicy/[id]/page.tsx:208` — status filter gated on PAYOUT

## Architecture Insights

- The status is a stored label that gates nothing; the type gate is the only place "does this
  booking need confirmation" is decided. Widening it is the whole create side.
- Ownership-in-WHERE (`DECIDABLE`) is the security model: an every-role `sessionAction` whose UPDATE
  matches zero rows for anything not his. A derived recipient keeps that shape — the predicate
  becomes `worker_id = me` for PAYOUT, `target_register_id IN (his kasy)` for REGISTER_TRANSFER,
  `source_register_id IN (his kasy)` for the deposits — one SQL fragment shared by decide, list and
  count, so the three can't drift.
- A rename splits at the `tsc` line (lessons „Renames and types"): the `payout_*` columns and the
  `payoutStatus` field name are persisted and worth ~0 to rename; symbols and copy carry the benefit.

## Historical Context (from prior changes)

- `context/archive/2026-10-11-worker-payout-confirmation/change.md:30-48` — rulings: label gates
  nothing; every new booking is pending, also without a login; rejection is a management
  notification that clears only on cancel or accept; rejected → accepted only; cancelled derived;
  old rows „—"; sheet unchanged; status column in the transfers table. Its plan-brief listed „status
  on other types" as out of scope (`git show 3cb723e38`).
- Ruling 3's „Wypłaty" page is gone — `50a2dd7c6` folded `/wyplaty` into Transakcje (status filter +
  rejected table on „/"). `118f4f333` removed the 14-day cancelled window.
- `context/archive/2026-10-11-pwa-push-notifications/` — „the sender is generic, so each later trigger
  is one call"; absolute badge count; trigger in the server action, not a hook. Push verified on an
  installed iPhone PWA and unpaused (`c7d57c84b`); body shortened (`011637b81`).
- `context/archive/2026-10-05-worker-expenses/change.md:20-24` — „Zaliczka pracownika to
  `REGISTER_TRANSFER` na jego kasę… jedyne powiązanie z pracownikiem to właściciel kasy".
- `context/archive/2026-09-29-worker-payout-remaining/change.md:65-66` — „zaliczka" also names paying
  a worker ahead (a PAYOUT); the glossary retired the stage-deposit „zaliczki"
  (`context/domain/02-glossary.md:182-186`). The glossary has no row for the confirmation status.
- `context/reference/roles-inventory.md:241-242` — known gap: a worker decides on a locked investment
  (the raw UPDATE skips the lock). Carries over to a Wpłata od inwestora.
- `context/foundation/test-plan.md:109` — risk #27's coverage still cites the removed 14-day window.

## Related Research

- `git show 3cb723e38:context/changes/2026-10-11-worker-payout-confirmation/research.md`
- `git show b28915e79` — pwa-push-notifications review gate

## Open Questions

1. ~~**Deposits**~~ — resolved (user, 2026-10-20): in scope. A deposit booked into a worker's kasa
   asks him to confirm, like a transfer. There's no sender kasa, so its copy names the deposit type.
2. ~~**The push copy for a transfer**~~ — resolved (user, 2026-10-20): „the cards are fine as they
   are". No sender line; `payouts-to-confirm.tsx` renders every kind unchanged. Only strings that say
   „wypłata" (`payoutsTitle`, `payoutAcceptTitle`, `payoutAccepted`, push body, …) go neutral.
3. ~~**Naming**~~ — resolved (user, 2026-10-20): the flow's code moves to „receipt" names, persisted
   `payout_*` names stay; neutral copy per `change.md`; glossary row „potwierdzenie odbioru".
4. ~~**Management table**~~ — resolved (planning, 2026-10-20): one table for all kinds with a „Typ"
   column; „Pracownik" = derived recipient, „Kasa" = receiving kasa.
5. ~~**Withdrawing a pending item on cancel**~~ — accepted: no push on cancel, the badge corrects on
   the next app open, same for every kind.
6. ~~**Korekta**~~ — resolved (user, 2026-10-20): out. It raises the balance but hands the worker
   nothing; the trigger is "money handed to the worker" — `REGISTER_TRANSFER` into his kasa, or a
   `DEPOSIT_TYPES` row on it. A new deposit type joins automatically.
