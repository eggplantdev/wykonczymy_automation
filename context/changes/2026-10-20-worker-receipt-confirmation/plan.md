# Worker Receipt Confirmation Implementation Plan

## Overview

A worker confirms every handover of money into his own kasa the way he confirms a wypłata today:
a Transfer między kasami into his kasa and any wpłata (Inna wpłata, Wpłata od inwestora, Zasilenie)
booked into it are born „Czeka na potwierdzenie", push him, count on his badge, and a rejection lands
in the management table on „/". The flow's code drops its wypłata names, and its copy goes neutral.

## Current State Analysis

The confirmation flow (built 2026-10-11) is generic in its back half — the status columns' date/reason
CHECKs, the decision UPDATEs, `AWAITING_MANAGEMENT`, the nav stream, `sendPushToUser`, `public/sw.js`,
the status badge/column/filter, `canCancelTransfer` — but PAYOUT and `worker_id` are hard-coded in:

- the CHECK `transactions_payout_status_only_on_payout` (`src/migrations/20261011_1_add_payout_confirmation.ts:22-23`)
  and `carriesPayoutStatus` (`src/lib/constants/transfers.ts:386`);
- the stamp on create (`src/collections/hooks/transfers/validate.ts:65-73`);
- who decides: `DECIDABLE`, `listPayoutsToConfirm`, `countPendingPayouts`
  (`src/lib/db/payout-confirmation.ts:36-38,68-99`) key on `worker_id = me AND type = 'PAYOUT'`;
- the management table: `listRejectedPayouts` joins `worker_id` and the source kasa only
  (`src/lib/db/payout-confirmation.ts:107-137`), `rejected-payouts.tsx` hard-codes wypłata copy;
- the push gate `carriesPayoutStatus(type) && worker` (`src/lib/actions/transfers.ts:97,241`);
- the worker page status filter `transferTypes.includes('PAYOUT')` (`pracownicy/[id]/page.tsx:208`);
- copy in pl/uk/ru.

Full map: `research.md`.

## Desired End State

- A Transfer między kasami whose target kasa is owned by an EMPLOYEE, and a wpłata (any
  `DEPOSIT_TYPES`) whose kasa is owned by an EMPLOYEE, is stored `payout_status = 'pending'`. A
  transfer between two kasy of the same owner, a korekta, and anything into a management kasa stay
  `NULL`. Old rows stay `NULL`.
- The recipient — the worker for a wypłata, the receiving kasa's owner otherwise — is derived in SQL
  by one fragment shared by decide, list, count, the rejected table and the push lookup. Only he can
  decide; any other user's UPDATE matches zero rows.
- He gets the push („Pieniądze do potwierdzenia" / „Potwierdź odbiór {kwota}."), the badge counts all
  kinds, the card in „Do potwierdzenia" is unchanged.
- „Odrzucone przez pracowników" on „/" lists every kind with „Typ", „Pracownik" (the recipient) and
  „Kasa" (the receiving kasa).
- No „wypłata" in the flow's copy; the flow's code uses „receipt" names; persisted names untouched.

### Key Discoveries:

- The receiving kasa is `target_register_id` for REGISTER_TRANSFER and `source_register_id` for the
  deposit types (`src/lib/db/sum-transfers.ts:25-44` — the balance rule).
- A used kasa's owner is locked (`src/collections/hooks/cash-registers/guard-update.ts:44-49`), its
  registers and amount can't be edited (`collections/transfers.ts` field access), so deriving the
  recipient on read is stable; only the owner's **role** is mutable, and that matters only at the
  create-time stamp.
- `cash_registers.owner_id` → `users.role` is the lookup (`src/lib/db/cash-register-trash.ts:26-27`).
- `DEPOSIT_TYPES` (`src/lib/constants/transfers.ts:239-243`) — a new deposit type joins automatically.
- `src/__tests__/setup/db.ts:50-51` pass-through-mocks `@/lib/push/notify-pending-payouts` by path —
  it moves with the rename.
- Lessons „Renames and types": rename symbols, never persisted names; `cached()`/storage keys are
  persisted.

## What We're NOT Doing

- Korekta, CANCELLATION, BONUS — no confirmation (user rulings).
- No backfill: old transfers and wpłaty into worker kasy stay „—"/blank.
- No change to balances, „Pozostało do wypłaty", marża or the sheet — the status gates nothing.
- No sender line on the card („the cards are fine as they are").
- No push/badge refresh on cancel (unchanged behaviour; badge corrects on next app open).
- No rename of persisted names: `payout_*` columns, the enum, the Payload fields `payoutStatus` /
  `payoutDecidedAt` / `payoutRejectionReason`, the push tag `payout-pending`, the DataTable /
  CollapsibleSection storage keys `rejected-payouts*`. Symbols named after the field
  (`PayoutStatusBadge`, `transferPayoutStatusText`, `payoutStatusLabel`, `carriesPayoutStatus`,
  i18n `payoutStatus_*` / `colPayout*` / `filterPayoutStatus` / `payoutCancelled`) stay too.
- Not touching the wypłata feature itself: PAYOUT, „Rozlicz wypłaty" (`settle-payouts.ts`),
  `worker-payout-pairs`, `get-payout-transactions`, the worker-page wypłata summary.
- The known locked-investment gap (`roles-inventory.md:241`) carries over unchanged.

## Implementation Approach

Rename first, alone, so the behaviour diff reads cleanly. Then widen the gate at the bottom (CHECK +
stamp), then the read side (one recipient fragment), then the push, then copy and docs. Each phase is
green on its own specs.

## Critical Implementation Details

- **Migration order:** the new CHECK only relaxes, so it is additive — migrate prod before pushing
  the code that stamps the new types (AGENTS.md → Migrations). Until then the old CHECK refuses the
  stamp and every booking of these types fails.
- **The stamp needs the owner role before the row exists:** look it up from the incoming register
  ids in the hook, not through the recipient fragment (which reads a stored row).

## Phase 1: Rename the confirmation flow to „receipt"

### Overview

Pure rename, no behaviour change.

### Changes Required:

#### 1. Data access, actions, queries, constants

**Files**: `src/lib/db/payout-confirmation.ts` → `src/lib/db/receipt-confirmation.ts`;
`src/lib/actions/payout-confirmation.ts` → `receipt-confirmation.ts`;
`src/lib/queries/payout-confirmation.ts` → `receipt-confirmation.ts`;
`src/lib/queries/pending-payouts.ts` → `pending-receipts.ts`;
`src/lib/constants/payout-confirmation.ts` → `receipt-confirmation.ts`

**Intent**: Names stop saying „wypłata" for a flow that now handles five kinds.

**Contract**: `acceptPayout`/`rejectPayout` → `acceptReceipt`/`rejectReceipt`; `listPayoutsToConfirm`
→ `listReceiptsToConfirm`; `countPendingPayouts` → `countPendingReceipts`; `REJECTED_PAYOUTS_COUNT`
→ `REJECTED_RECEIPTS_COUNT`; `listRejectedPayouts` → `listRejectedReceipts`; `PayoutToConfirmT` /
`RejectedPayoutT` → `ReceiptToConfirmT` / `RejectedReceiptT`; the action and fetch functions likewise
(`fetchReceiptsToConfirm`, `fetchRejectedReceipts`, `fetchOwnPendingReceiptCount`, the accept/reject
actions); `PAYOUT_STATUSES`/`PayoutStatusT`/`isPayoutStatus` → `RECEIPT_STATUSES`/`ReceiptStatusT`/
`isReceiptStatus`.

#### 2. Push

**Files**: `src/lib/push/notify-pending-payouts.ts` → `notify-pending-receipts.ts`,
`src/lib/push/constants.ts`, `src/__tests__/setup/db.ts`

**Intent**: Same rename on the push side; the global mock follows the new path.

**Contract**: `notifyPendingPayouts` → `notifyPendingReceipts`; `BookedPayoutT { workerId, amount }`
→ `BookedReceiptT { recipientId, amount }`; `PAYOUT_PUSH_PAUSED` → `RECEIPT_PUSH_PAUSED`. Tag stays
`payout-pending`.

#### 3. Components and nav stream

**Files**: `src/components/payouts/` → `src/components/receipts/` (`receipts-to-confirm.tsx`,
`reject-receipt-dialog.tsx`, `rejected-receipts.tsx`, `verify-rejected-receipt-dialog.tsx`;
`payout-status-badge.tsx` moves keeping its name); `src/types/notifications.ts`,
`src/components/nav/unread-badge.tsx`, `src/lib/constants/sections.ts`,
`src/lib/queries/unread-counts.ts`, `src/lib/db/shell-badge-counts.ts`,
`src/__tests__/helpers/stream-counts.ts`

**Intent**: Components and the `rejectedPayouts` nav stream follow.

**Contract**: stream key `rejectedPayouts` → `rejectedReceipts`; storage keys unchanged.

#### 4. i18n keys

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` and their readers

**Intent**: The flow's keys get receipt names (values change in phase 5).

**Contract**: `payoutAlreadyDecided`, `payoutReasonTooShort/TooLong`, `payoutsTitle/Hint`,
`rejectedPayoutsTitle/Hint`, `payoutNoInvestment`, `payoutConfirm`, `payoutReject`,
`payoutRejectionReason`, `payoutAccept*`, `payoutAccepted`, `payoutReject*`, `payoutReason*`,
`payoutRejected`, `payoutPushTitle/Body` → `receipt…` equivalents. Field-named keys stay.

#### 5. Specs

**Files**: `src/__tests__/lib/db/payout-confirmation.db.test.ts`,
`src/__tests__/lib/actions/payout-confirmation.test.ts`,
`src/__tests__/lib/push/notify-pending-payouts.test.ts`,
`src/__tests__/components/payouts/payouts-to-confirm.test.tsx` → receipt names, mirrored paths.
`payout-status-default.db.test.ts` keeps its name (it tests the field).

### Success Criteria:

#### Automated Verification:

- Renamed specs pass: `pnpm exec vitest run src/__tests__/lib/actions/receipt-confirmation.test.ts src/__tests__/lib/push src/__tests__/components/receipts`
- Renamed DB spec passes: `pnpm exec vitest run --project db src/__tests__/lib/db/receipt-confirmation.db.test.ts`
- No stale import path: `grep -rn "payout-confirmation\|notify-pending-payouts\|pending-payouts\|components/payouts" src e2e` returns nothing

#### Manual Verification:

- none (no behaviour change)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Stamp money handed to an employee as pending

### Overview

The DB accepts the status on the new types, and the hook stamps it when the receiving kasa belongs to
an EMPLOYEE.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261020_1_receipt_status_on_money_in.ts` (next free counter for the date
at write time) + `src/migrations/index.ts`

**Intent**: Replace the PAYOUT-only CHECK with one allowing the confirmable types.

**Contract**: drop `transactions_payout_status_only_on_payout`; add
`transactions_payout_status_only_on_money_in` CHECK
`payout_status IS NULL OR type IN ('PAYOUT','REGISTER_TRANSFER','INVESTOR_DEPOSIT','COMPANY_FUNDING','OTHER_DEPOSIT')`.
Header: hand-written, additive — migrate prod before pushing. `down` restores the old CHECK.

#### 2. Type gate

**File**: `src/lib/constants/transfers.ts`

**Intent**: `carriesPayoutStatus` answers „can this type carry the status" — now PAYOUT,
REGISTER_TRANSFER and `DEPOSIT_TYPES`.

**Contract**: same signature; its readers (admin conditions in `collections/transfers.ts:299-317`,
`transfer-text.ts:59`) keep working. `transferPayoutStatusText` renders „—" for a `NULL` status only
on PAYOUT (old wypłaty); on the other types a `NULL` renders blank, so a transfer between management
kasy doesn't read as „unanswered".

#### 3. Employee-receives lookup

**File**: `src/lib/db/receipt-confirmation.ts`

**Intent**: One statement answering „is this money handed to an employee": the receiving kasa's owner
has role EMPLOYEE and, for a transfer, is not also the sending kasa's owner.

**Contract**: `handsMoneyToEmployee(db, { receivingRegisterId, sendingRegisterId? }): Promise<boolean>`.

#### 4. Stamp on create

**File**: `src/collections/hooks/transfers/validate.ts:65-73`

**Intent**: On create: PAYOUT → `pending` (unchanged); REGISTER_TRANSFER → `pending` iff
`handsMoneyToEmployee(target, source)`; a deposit type → `pending` iff `handsMoneyToEmployee(source)`;
everything else `null`. Update still strips the three keys.

**Contract**: unchanged hook signature; the registers are the already-resolved `sourceRegister` /
`targetRegister` (`resolveId`).

#### 5. Specs

**Files**: `src/__tests__/collections/hooks/transfers/payout-status-default.db.test.ts`,
`src/__tests__/lib/actions/transfers.db.test.ts:298,306`, `src/__tests__/lib/constants/transfers.test.ts:161-163`

**Intent**: Red first for the new rule, asserting the persisted row.

**Contract**: pending — transfer into an EMPLOYEE kasa (WORKER and AUXILIARY), each deposit type into
one; `NULL` — transfer into a management kasa, transfer between two kasy of one employee, korekta and
expense on an employee kasa; a Local API edit can't move the status; the CHECK refuses a status on an
EXPENSE via raw SQL. `transfers.db.test.ts` and `transfers.test.ts` updated to the new truth.

### Success Criteria:

#### Automated Verification:

- Migration applies on the test DB: `pnpm db:migrate:test`
- Stamp specs pass: `pnpm exec vitest run --project db src/__tests__/collections/hooks/transfers/payout-status-default.db.test.ts src/__tests__/lib/actions/transfers.db.test.ts`
- Gate spec passes: `pnpm exec vitest run src/__tests__/lib/constants/transfers.test.ts`

#### Manual Verification:

- Booking a Transfer między kasami into a worker's kasa shows „Czeka na potwierdzenie" in its
  Transakcje row; a transfer between two management kasy shows nothing in that column

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: One recipient rule for decide, list, count and the rejected table

### Overview

Ownership moves from `worker_id` to a derived recipient, shared by every read and write.

### Changes Required:

#### 1. Recipient fragment and its users

**File**: `src/lib/db/receipt-confirmation.ts`

**Intent**: One SQL expression yields the recipient of row `t`, and every query uses it, so decide,
list and count can't drift (test-plan risk #27: the WHERE is the whole gate).

**Contract**:

```sql
CASE WHEN t.type = 'PAYOUT' THEN t.worker_id
     ELSE (SELECT owner_id FROM cash_registers r
           WHERE r.id = CASE WHEN t.type = 'REGISTER_TRANSFER'
                             THEN t.target_register_id ELSE t.source_register_id END)
END
```

`DECIDABLE(id, me)` = `id AND <recipient> = me AND payout_status IS NOT NULL AND cancelled IS NOT TRUE`;
`listReceiptsToConfirm` / `countPendingReceipts` filter `payout_status` first, then `<recipient> = me`
(no type filter). `listRejectedReceipts` joins `users` on the recipient and `cash_registers` on the
receiving kasa (same CASE), and selects `type`. `RejectedReceiptT`: `workerId/Name` →
`recipientId/Name`, `sourceRegister*` → `register*`, new `type`. New
`pendingReceiptsOf(db, transactionIds): Promise<BookedReceiptT[]>` — recipient + amount of the given
rows still `pending` (phase 4's push lookup).

#### 2. Management table

**File**: `src/components/receipts/rejected-receipts.tsx`

**Intent**: Every kind in one table: a „Typ" column (`TRANSFER_TYPE_LABELS`), „Pracownik" from the
recipient, „Kasa" the receiving kasa.

**Contract**: consumes the reshaped `RejectedReceiptT`; storage keys unchanged.

#### 3. Specs

**File**: `src/__tests__/lib/db/receipt-confirmation.db.test.ts`

**Intent**: Risk #27 for the new kinds, persisted state asserted.

**Contract**: the receiving worker accepts/rejects a transfer and a deposit; the sending kasa's owner,
another worker and the booker change nothing; a transfer A's kasa → B's kasa is B's, never A's;
list and count include transfers and deposits and exclude cancelled/accepted; the rejected list
returns type, recipient name and receiving kasa; existing PAYOUT cases stay green.

### Success Criteria:

#### Automated Verification:

- Ownership spec passes: `pnpm exec vitest run --project db src/__tests__/lib/db/receipt-confirmation.db.test.ts`
- Rejected-table DOM spec (if the table has one) and `receipts-to-confirm.test.tsx` pass: `pnpm exec vitest run src/__tests__/components/receipts`

#### Manual Verification:

- As the worker, a transfer into his kasa appears in „Do potwierdzenia"; confirming it flips the
  row to „Potwierdzona"
- Rejecting it puts it in „Odrzucone przez pracowników" on „/" with Typ „Transfer między kasami",
  his name and his kasa; „Anuluj" there cancels it

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Push and badge for every kind

### Overview

A push for every new pending item, badge = all pending kinds.

### Changes Required:

#### 1. Notify

**File**: `src/lib/push/notify-pending-receipts.ts`

**Intent**: Sum per recipient, badge `countPendingReceipts`, url `/pracownicy/${recipientId}`.

**Contract**: `notifyPendingReceipts(db, BookedReceiptT[])`.

#### 2. Call sites

**Files**: `src/lib/actions/transfers.ts:96-101,240-244`, `src/lib/actions/settle-payouts.ts:117`

**Intent**: Both create actions drop the `carriesPayoutStatus && worker` gate and ask the DB which
created rows went pending: `after(() => notifyPendingReceipts(db, await pendingReceiptsOf(db, ids)))`.
`settle-payouts` passes `{ recipientId: worker, amount }`.

**Contract**: `createTransferAction` keeps the id from `payload.create`.

#### 3. Specs

**Files**: `src/__tests__/lib/push/notify-pending-receipts.test.ts`, `src/__tests__/lib/push/push-client.test.ts`,
`src/__tests__/lib/actions/transfers.db.test.ts`

**Contract**: a transfer into an employee kasa notifies its owner with the amount; one into a
management kasa notifies nobody; the badge count includes a pending transfer.

### Success Criteria:

#### Automated Verification:

- Push specs pass: `pnpm exec vitest run src/__tests__/lib/push`
- Action spec passes: `pnpm exec vitest run --project db src/__tests__/lib/actions/transfers.db.test.ts`

#### Manual Verification:

- Production-only: an installed phone PWA gets „Pieniądze do potwierdzenia" for a transfer into the
  worker's kasa, and the icon badge counts it (see `manual-checks.md` push section)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Neutral copy, worker filter, docs

### Changes Required:

#### 1. Copy

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`, `src/components/receipts/rejected-receipts.tsx`

**Intent**: The approved table in `change.md` — pl verbatim, uk/ru the same meaning, gender-neutral.

#### 2. Worker page filter

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx:208`

**Intent**: „Potwierdzenie" filter shows when any listed type carries the status.

**Contract**: `showPayoutStatusFilter: transferTypes.some(carriesPayoutStatus)`.

#### 3. Docs

**Files**: `context/domain/02-glossary.md`, `context/foundation/test-plan.md:109`,
`context/reference/roles-inventory.md` (if it describes the confirmation as wypłata-only)

**Intent**: Glossary row „potwierdzenie odbioru" → `payout_status` (persisted) / receipt (code), what
triggers it, who confirms. Risk #27 coverage: drop the removed 14-day window, add the kasa-owner
recipient. Fix any doc that asserts the flow is wypłata-only.

### Success Criteria:

#### Automated Verification:

- Copy-reading specs pass: `pnpm exec vitest run src/__tests__/components/receipts src/__tests__/lib/transfers/transfer-text.test.ts`
- No „wypłat" left in the flow's copy: `grep -n "receipt" src/lib/i18n/dictionaries/pl.ts | grep -i "wypłat"` returns nothing

#### Manual Verification:

- The worker page reads „Do potwierdzenia" / „Potwierdzasz odbiór?" / „Odbiór potwierdzony" for a
  wypłata and a transfer alike, in pl and uk
- A wpłata into a worker's kasa shows on his page with the „Potwierdzenie" filter

---

## Testing Strategy

### Unit Tests:

- `carriesPayoutStatus` per type; `transferPayoutStatusText` „—" only on a NULL wypłata.
- Notify: per-recipient sum, badge, url.

### Integration Tests:

- Stamp matrix (phase 2) and ownership matrix (phase 3) on the real DB, persisted state asserted.

### Manual Testing Steps:

1. Local test DB (5435), as a manager book a Transfer między kasami into a worker's kasa.
2. Log in as that worker: it's in „Do potwierdzenia"; confirm it.
3. Book another, reject it with a reason; as the manager see it on „/" with Typ/Pracownik/Kasa; cancel.
4. Book an Inna wpłata into the worker's kasa — it asks him too.
5. Book a transfer between two management kasy and a korekta on the worker's kasa — nothing asks.

E2E: the review gate decides whether this slice owes a Playwright spec or an `e2e-backlog` issue.

## Performance Considerations

The recipient is a correlated subquery evaluated after the `payout_status` filter, so it runs only on
pending/rejected rows (a handful per worker). No index on `payout_status`; a seq scan on
`transactions` is fine at this size.

## Migration Notes

Additive: `pnpm db:migrate:prod` (human) before the push. No backfill.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Touched specs pass (listed per phase); full suite only on request

## References

- Research: `context/changes/2026-10-20-worker-receipt-confirmation/research.md`
- Prior flow: `context/archive/2026-10-11-worker-payout-confirmation/`
- Balance rule: `src/lib/db/sum-transfers.ts:25-44`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rename the confirmation flow to „receipt"

#### Automated

- [ ] 1.1 Renamed specs pass
- [ ] 1.2 Renamed DB spec passes
- [x] 1.3 No stale import path — 84620ed50

### Phase 2: Stamp money handed to an employee as pending

#### Automated

- [ ] 2.1 Migration applies on the test DB
- [ ] 2.2 Stamp specs pass
- [ ] 2.3 Gate spec passes

### Phase 3: One recipient rule for decide, list, count and the rejected table

#### Automated

- [ ] 3.1 Ownership spec passes
- [ ] 3.2 Rejected-table and receipts-to-confirm DOM specs pass

### Phase 4: Push and badge for every kind

#### Automated

- [ ] 4.1 Push specs pass
- [ ] 4.2 Action spec passes

### Phase 5: Neutral copy, worker filter, docs

#### Automated

- [ ] 5.1 Copy-reading specs pass
- [x] 5.2 No „wypłat" left in the flow's copy — 05447566d
