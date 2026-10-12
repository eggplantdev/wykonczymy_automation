# Worker Payout Confirmation Implementation Plan

## Overview

Every new wypłata (`PAYOUT`) starts `pending`. The worker confirms it („Potwierdzam") or rejects it with a
required reason on his own `/pracownicy/[id]`. Management sees the status, the decision date and the
reason in every transfers table, on a new „Wypłaty" page, and as a queue of rejected wypłaty pinned
on `/` with „Zweryfikuj". The status is a **label**: no figure (kasa balance, „Pozostało do wypłaty",
marża, sheet) reads it.

Linear: EX-1042. Blocks EX-1040 (`pwa-push-notifications`).

## Current State Analysis

- `transactions` has no lifecycle column — only `cancelled` and `settled` booleans. A PAYOUT's
  amount, worker and source kasa are frozen after booking (`updateTransferAction` edits the amount
  only for `LABOR_COST`, `lib/actions/transfers.ts:318-319`).
- Every booking path is a Local API `payload.create` (`transfers.ts:70,156`, `settle-payouts.ts:95`)
  and runs `validateTransfer` (`collections/transfers.ts:80`, `beforeValidate`), which already
  normalises per-type fields (it nulls `vatPlane` / `paymentMethod` on types that don't carry them).
- The transfers list reads through `payload.find` at `depth: 0` (`lib/queries/transfers.ts:36`) and
  maps docs in `lib/queries/transfer-mapping.ts:77` — a new column must be a **Payload field** or
  the table never sees it.
- The sum tile and facets turn the same `Where` into SQL through `lib/db/where-to-sql.ts`, whose
  `FIELD_TO_COLUMN` (`:9`) throws on any unmapped field (EX-574).
- Queue plumbing exists: `UnreadStreamT` (`types/notifications.ts`), `QUEUE_STREAMS`
  (`components/nav/unread-badge.tsx:16`), `fetchUnreadCounts` (`lib/queries/unread-counts.ts`),
  `NAV_LINKS.unreadStream` (`lib/constants/sections.ts`). Pinned dashboard block precedent:
  `PendingExpenseDrafts` in `components/dashboard/manager-dashboard.tsx`.
- EMPLOYEE-callable writes go through `sessionAction` (`lib/actions/run-action.ts:88`) with
  ownership in the SQL `WHERE` — precedent `deletePendingExpenseDraft`
  (`lib/db/worker-expense-drafts.ts:580-596`).
- Full grounding: `research.md`. Rulings 1–8: `change.md`.

## Desired End State

- A new PAYOUT, booked by any path, is stored `pending`; every other type and every pre-existing
  wypłata has no status (rendered „—").
- The worker opens his page and sees „Wypłaty do potwierdzenia" at the top: each pending wypłata
  with „Potwierdzam" (confirm dialog naming the amount) and „Odrzuć" (dialog with a required reason,
  min/max counter, confirm disabled until valid); each rejected one with „Potwierdzam" only; each
  wypłata cancelled in the last 14 days while still undecided, with an „Anulowana" badge and no
  buttons. Copy in pl/uk/ru.
- A decision on a wypłata that isn't his, is cancelled, or was already decided changes nothing and
  returns a translated notice.
- Every transfers table has status, decision-date and reason columns (filled on PAYOUT rows only,
  hideable through the existing column toggle).
- `/wyplaty` lists wypłaty only, with a status filter; the nav item carries the count of rejected,
  not-cancelled wypłaty.
- `/` shows a pinned „Wypłaty odrzucone przez pracowników" block while any exist; „Zweryfikuj" opens
  a dialog with the wypłata's details, the worker's reason and the cancellation action. The entry
  leaves the queue only when the wypłata is cancelled or the worker accepts it.

### Key Discoveries:

- `validateTransfer` is the one hook every write path passes — the create-time default lives there,
  not in each action (`collections/transfers.ts:80`).
- A decision through `payload.update` would be refused on a locked investment
  (`hooks/transfers/validate.ts:67-80`) and re-fire the sheet sync — the decision is a raw-SQL
  `UPDATE` in `src/lib/db`, so no collection hook runs and the action must expire
  `CACHE_TAGS.transfers` itself (`sessionAction(…, ['transfers'])`).
- `where-to-sql.ts:9` must learn `payoutStatus`, or the status filter throws in the sum tile.
- `SERVER_SORTABLE_TRANSFER_COLUMNS` (`lib/transfers/sortable-columns.ts:6`) is the whitelist the
  column builder derives sortability from — status and decision date are own columns, so they join it.
- The cancellation timestamp is the `CANCELLATION` row's `created_at` (linked by
  `cancelled_transaction_id`); the original carries none.

## What We're NOT Doing

- No change to any figure, reader or golden-master fixture — pending counts everywhere (ruling 1).
- No Google Sheets change — the „transfery" tab keeps its 8 columns (ruling 7).
- No backfill: existing wypłaty stay `NULL` (ruling 6, lesson `lessons.md:1079`).
- No push, no app-icon badge, no e-mail — EX-1040.
- No status for BONUS or any other type.
- No reset of the status on a management edit (date, description, investment) — amount and worker
  cannot change, so the worker's statement still holds.
- No worker-side nav count — a worker has no nav (`use-nav-links.ts:19`).
- No accepted → rejected; rejected → accepted only (ruling 4).
- No pinned block for a manager viewing a worker's page — he reads the status column there.
- No E2E authored in this change (see Testing Strategy).

## Implementation Approach

Two planes kept apart: **booking** (management, Payload write, hooks, sheet) stamps `pending`; the
**acknowledgment** (worker, one raw `UPDATE`, no hooks) moves it. The database enforces the shape
with CHECK constraints, so neither plane can write a malformed state. UI follows existing
precedents one-for-one: the transfers table and filters for the management list, the expense-draft
queue for the pinned block and the nav count, the cancellation dialog for the reason field.

## Critical Implementation Details

**Stripping on update.** `validateTransfer` must drop `payoutStatus` / `payoutDecidedAt` /
`payoutRejectionReason` from every **update**'s data, not only set them on create — a Local API
write runs with `overrideAccess: true` and skips field access, so the field's `access.update` alone
does not stop an edit from overwriting the worker's decision.

**Filter mapping.** Add `payoutStatus` to `FIELD_TO_COLUMN` in the same commit as the filter, or
`/wyplaty?payoutStatus=rejected` 500s in the sum tile while the list renders.

---

## Phase 1: Schema and booking default

### Overview

The three columns exist, are enforced by the database, ride through the transfers read into
`TransferRowT`, and every new PAYOUT is born `pending`.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261011_1_add_payout_confirmation.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add the status enum and three nullable columns to `transactions`, with invariants the
decision SQL can't violate. Hand-written from the `20260721_1_add_vat_plane_to_transactions.ts`
template. Additive — prod is migrated by a human before the push.

**Contract**:

- `enum_transactions_payout_status` = `('pending','accepted','rejected')` in a `DO $$ … duplicate_object` block.
- `payout_status enum_transactions_payout_status NULL`, `payout_decided_at timestamptz NULL`,
  `payout_rejection_reason varchar NULL`. No default, no backfill.
- CHECK constraints (named, dropped in `down`):
  - status only on wypłaty: `payout_status IS NULL OR type = 'PAYOUT'`;
  - decided ⇔ timestamp: `(payout_status IS NULL OR payout_status = 'pending') = (payout_decided_at IS NULL)`;
  - rejected ⇒ reason: `payout_status <> 'rejected' OR payout_rejection_reason IS NOT NULL`;
  - reason only after a rejection: `payout_rejection_reason IS NULL OR payout_status IN ('rejected','accepted')`.
- `down` drops constraints, columns, type.
- Before running it locally: `git status src/migrations` (shared tree).

#### 2. Collection fields

**File**: `src/collections/transfers.ts`

**Intent**: Expose the columns to `payload.find` so the table reads them; nobody edits them through
Payload.

**Contract**: fields `payoutStatus` (select, options pending/accepted/rejected),
`payoutDecidedAt` (date, with time), `payoutRejectionReason` (textarea); each
`access: { update: () => false }`, `admin.readOnly`, `admin.condition` = type is PAYOUT. Then
`pnpm generate:types` (never `git add` the output).

#### 3. Create-time default

**File**: `src/hooks/transfers/validate.ts`

**Intent**: Stamp `pending` on every PAYOUT at creation, whichever path booked it; keep the three
fields out of every update (see Critical Implementation Details).

**Contract**: on `operation === 'create'`: PAYOUT → `payoutStatus = 'pending'`, decided-at and
reason null; any other type → all three null. On `update`: delete the three keys from `data`.

#### 4. Row type and mapping

**Files**: `src/types/transfers.ts`, `src/lib/queries/transfer-mapping.ts`, the test fixture
`src/__tests__/components/transfers/cards/transfer-card-columns.test.tsx` (ROW literal)

**Intent**: Carry the three values to the UI.

**Contract**: `TransferRowT` gains `payoutStatus: PayoutStatusT | null`,
`payoutDecidedAt: string | null`, `payoutRejectionReason: string | null`. `PayoutStatusT` and the
status list live in a new `src/lib/constants/payout-confirmation.ts` (the
`lib/constants/worker-expense-drafts.ts` shape: `PAYOUT_STATUSES`, `isPayoutStatus`).

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate`
- New DB spec passes: `pnpm exec vitest run src/__tests__/hooks/transfers/payout-status-default.db.test.ts` — a PAYOUT created through `payload.create` is `pending` with null decided-at/reason; an `INVESTMENT_EXPENSE` gets null; an update carrying `payoutStatus: 'accepted'` leaves the stored status unchanged; a raw `UPDATE` setting `accepted` without `payout_decided_at` is refused by the CHECK
- Existing transfer-mapping / card specs pass: `pnpm exec vitest run src/__tests__/components/transfers`

#### Manual Verification:

- Booking a wypłata through „Wydatek" and through „Rozlicz wypłaty" (local, 5435 or dev DB) — both rows show status pending in Payload's DB (`SELECT id, payout_status FROM transactions ORDER BY id DESC LIMIT 2`).

**Implementation Note**: When this phase's automated verification passes, commit and continue — do **not** pause for per-phase manual confirmation. Manual verification is collected once, at the end of the change, into the manual-checks registry.

---

## Phase 2: The worker's decision (server)

### Overview

The two decisions, the worker's "to confirm" read and the management queue reads exist, scoped and
race-guarded in SQL, behind actions an EMPLOYEE can call.

### Changes Required:

#### 1. Data access

**File**: `src/lib/db/payout-confirmation.ts`

**Intent**: One statement per concern, ownership and state in the `WHERE`, so a foreign, cancelled
or already-decided wypłata simply matches zero rows.

**Contract**:

- `acceptPayout(db, { transactionId, workerId }): Promise<boolean>` — `SET payout_status='accepted', payout_decided_at=now()` `WHERE id AND worker_id AND type='PAYOUT' AND cancelled IS NOT TRUE AND payout_status IN ('pending','rejected')`; reason untouched (kept after a change of mind).
- `rejectPayout(db, { transactionId, workerId, reason }): Promise<boolean>` — same guard but `payout_status = 'pending'` only.
- `listPayoutsToConfirm(db, workerId)` — his PAYOUTs that are (not cancelled AND pending|rejected) OR (cancelled AND pending|rejected AND their CANCELLATION row's `created_at` > now() − 14 days); row: id, date, amount, description, investment name, status, reason, cancelled. Pending first, then by date desc.
- `countRejectedPayouts(db)` and `listRejectedPayouts(db)` — `payout_status='rejected' AND cancelled IS NOT TRUE`; the list joins worker, investment and source kasa names and carries `investmentId`, `createdById` (for the cancel affordance).
- The 14 days is a named constant in `lib/constants/payout-confirmation.ts`.

#### 2. Actions and reads

**Files**: `src/lib/actions/payout-confirmation.ts`, `src/lib/queries/payout-confirmation.ts`,
`src/lib/schemas/payout-confirmation.ts`

**Intent**: Worker-callable writes that take only the transaction id (and reason) — never whose
wypłata it is — and uncached reads for the two pinned blocks.

**Contract**:

- `acceptPayoutAction(transactionId)` / `rejectPayoutAction(transactionId, { reason })` —
  `sessionAction(label, handler, ['transfers'])`, `workerId = ctx.user.id`; zero rows →
  `noticeFailure('payoutAlreadyDecided')`. Reason schema reuses `CANCEL_REASON_MIN_LENGTH` /
  `MAX_LENGTH` from `lib/schemas/transfer.ts`, trimmed.
- `fetchPayoutsToConfirm(workerId)` (called by the page only for `isOwnPage`) and
  `fetchRejectedPayouts()` — uncached like `fetchPendingExpenseDrafts`.
- `countRejectedPayouts` joins `fetchUnreadCounts` in Phase 4.

#### 3. Notice and test-plan risk

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` (`notices.payoutAlreadyDecided`),
`context/foundation/test-plan.md`

**Intent**: The refusal reads in the worker's language; the new risk is anchored before its specs.

**Contract**: risk #27 — "A worker decides a wypłata that is not his, or a decision lands on a
cancelled or already-decided wypłata, or a new wypłata is booked without a status." Add it with
`/10x-test-plan`.

### Success Criteria:

#### Automated Verification:

- DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/payout-confirmation.db.test.ts` — worker B accepting A's wypłata changes nothing; a second reject on a rejected wypłata changes nothing; any decision on a cancelled wypłata changes nothing; rejected → accepted keeps the reason and moves the timestamp; accepted → rejected is refused; `listPayoutsToConfirm` includes a wypłata cancelled 1 day ago and excludes one cancelled 15 days ago and one accepted; `countRejectedPayouts` drops a rejected wypłata once it is cancelled
- Action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/payout-confirmation.test.ts` — a reason under the minimum is refused before any write; zero rows yields the `payoutAlreadyDecided` notice; success revalidates `transfers`

#### Manual Verification:

- None beyond the UI phases.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Worker UI

### Overview

The worker's pinned block with both dialogs, on his own page, at 390px, in three languages.

### Changes Required:

#### 1. Shared reason field

**Files**: new `src/components/ui/reason-field.tsx` (or beside the transfers components if it reads
domain constants — keep `ui/` free of feature imports), `src/components/transfers/cancel-transfer-button.tsx`

**Intent**: One textarea + min/max counter for both dialogs; the cancellation dialog keeps its exact
Polish copy and behavior.

**Contract**: props `value`, `onChange`, `min`, `max`, `label`, `placeholder`, `counterText`
(caller-supplied strings so the worker's copy is translated), `disabled`; exposes nothing else.
`cancel-transfer-button.tsx` renders it with its current strings.

#### 2. Pinned block and dialogs

**Files**: `src/components/payouts/payouts-to-confirm.tsx`,
`src/components/payouts/accept-payout-dialog.tsx`, `src/components/payouts/reject-payout-dialog.tsx`,
`src/components/payouts/payout-status-badge.tsx`, `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: The first thing the worker sees on opening his page while anything waits.

**Contract**:

- Rendered only when `isOwnPage` and the list is non-empty, above `WorkerQuickActions`.
- Each row: date, amount (`formatPLN`), investment, description, status badge; pending → „Potwierdzam" + „Odrzuć"; rejected → his reason + „Potwierdzam"; cancelled → „Anulowana" badge, no buttons.
- Accept dialog names the amount and is the only path to `acceptPayoutAction`. Reject dialog uses the shared reason field; confirm disabled until valid.
- Status badge mirrors `DraftStatusBadge` (`BADGE_TONE` pending/positive/muted, plus `destructive`-ish tone for rejected and muted for cancelled); "cancelled" is derived from `cancelled`, never stored.
- Copy via `useTranslation('workerPage')` — new keys in `pl.ts`, `uk.ts`, `ru.ts` (status labels, block title, both dialogs, toasts).

### Success Criteria:

#### Automated Verification:

- DOM spec passes: `pnpm exec vitest run src/__tests__/components/payouts/payouts-to-confirm.test.tsx` — a pending row shows both buttons, a rejected one only „Potwierdzam", a cancelled one none; the reject confirm stays disabled under the minimum and enables at it; accept calls the (mocked) action only after the dialog's confirm
- Existing cancellation dialog spec (if any) still passes: `pnpm exec vitest run src/__tests__/components/transfers`

#### Manual Verification:

- As an EMPLOYEE at 390px: the block sits at the top, both dialogs fit, accepting moves the row out, rejecting with a reason leaves it as rejected with „Potwierdzam".
- Switching the account language to Українська shows the block and dialogs in Ukrainian.
- A wypłata management cancels while pending shows „Anulowana" without buttons on the worker's next load.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Management surfaces

### Overview

Status in every transfers table, the „Wypłaty" page, the nav count and the pinned rejected queue on
`/` with „Zweryfikuj".

### Changes Required:

#### 1. Table columns

**Files**: `src/components/tables/transfers.tsx`, `src/lib/transfers/sortable-columns.ts`,
`src/lib/i18n/dictionaries/{pl,uk,ru}.ts` (`transfers` namespace)

**Intent**: Three columns filled only on PAYOUT rows (ruling 8), hideable via the existing toggle.

**Contract**: column ids `payoutStatus` (badge; „—" on a PAYOUT with `null`; empty on other types;
„Anulowana" when `cancelled`), `payoutDecidedAt` (`formatPLDateTime`), `payoutRejectionReason`
(`whitespace-pre-line`). Each with `meta.printValue`. `payoutStatus` and `payoutDecidedAt` join
`SERVER_SORTABLE_TRANSFER_COLUMNS`. The worker's own transfers table keeps the status column (it is
his history); `payoutRejectionReason` may stay too.

#### 2. Status filter

**Files**: `src/lib/queries/transfer-filters.ts`, `src/lib/db/where-to-sql.ts`,
`src/components/transfers/transfer-filters.tsx`, the filter config type

**Intent**: Narrow by status on `/wyplaty`, consistently in list, sum tile and facets.

**Contract**: URL param `payoutStatus` (csv, `isPayoutStatus`-validated; empty → `NO_RESULTS`, the
same sentinel convention as `type`) → `where.payoutStatus = { in }`. `FIELD_TO_COLUMN.payoutStatus =
'payout_status'`. The filter control is offered only when the config sets `showPayoutStatusFilter`.

#### 3. „Wypłaty" page

**Files**: `src/app/(frontend)/wyplaty/page.tsx`, `src/app/(frontend)/wyplaty/loading.tsx`,
`src/lib/constants/sections.ts`

**Intent**: Management's list of wypłaty with their status, built like the kasa page.

**Contract**: `requireManagementPage()`; strip `type` from search params, `buildTransferFilters`,
then `where.type = { equals: 'PAYOUT' }`; `TransfersSection` with `excludeColumns: ['type']`,
`buildFilterConfig(refData)` without `transferTypes`, `showPayoutStatusFilter: true`.
`PAGE_TITLES.payouts = 'Wypłaty'`; `NAV_LINKS` entry `{ href: '/wyplaty', icon: HandCoins (or
similar), unreadStream: 'rejectedPayouts' }` after „Pracownicy"; `loading.tsx` renders
`TitledPageLoading` with `PAGE_TITLES.payouts`.

#### 4. Queue stream

**Files**: `src/types/notifications.ts`, `src/lib/queries/unread-counts.ts`,
`src/components/nav/unread-badge.tsx`

**Intent**: The nav count of rejected wypłaty awaiting management, never cleared by opening the page.

**Contract**: `UnreadStreamT` gains `'rejectedPayouts'`; `NONE` and the `Promise.all` gain
`countRejectedPayouts`; `QUEUE_STREAMS` gains it.

#### 5. Pinned rejected queue on `/`

**Files**: `src/components/payouts/rejected-payouts.tsx`,
`src/components/payouts/verify-rejected-payout-dialog.tsx`,
`src/components/dashboard/manager-dashboard.tsx`

**Intent**: Ruling 3 — rejected wypłaty sit on the home page until cancelled or accepted.

**Contract**: `fetchRejectedPayouts()` joins the dashboard's `Promise.all`; the block renders below
`PendingExpenseDrafts` only when non-empty: a `DataTable` (date, worker, amount, investment, reason,
decision date) with a „Zweryfikuj" action. The dialog shows the details and the reason and holds
`CancelTransferButton` (the existing required-reason cancellation); on a locked investment it shows
`INVESTMENT_LOCKED_MESSAGE` instead. A MANAGER who may not cancel this wypłata is refused by
`cancelTransferAction` exactly as in the table — no separate client gate.

### Success Criteria:

#### Automated Verification:

- Filter spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts` — `payoutStatus=rejected` yields `{ in: ['rejected'] }`, an invalid value yields `NO_RESULTS`
- where-to-sql spec passes: `pnpm exec vitest run src/__tests__/lib/db/where-to-sql.test.ts` — `payoutStatus` renders against `payout_status`
- Column spec passes: `pnpm exec vitest run src/__tests__/components/tables/transfers.test.tsx` — status cell empty on a non-PAYOUT row, „—" on a legacy PAYOUT, „Anulowana" on a cancelled one
- Unread counts spec (if present) passes with the new stream: `pnpm exec vitest run src/__tests__/lib/queries/unread-counts.test.ts`

#### Manual Verification:

- `/wyplaty` lists only wypłaty; the status filter narrows the list and the sum tile together; sorting by status and by decision date works.
- A rejection from the worker shows on `/` in the pinned block and as a count on „Wypłaty"; „Zweryfikuj" shows the reason; cancelling from the dialog removes it from the block and the count on the next load.
- On `/`, the status column can be hidden with the column toggle and stays hidden after reload.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Filter parsing and `where-to-sql` mapping for `payoutStatus`.
- Reason schema bounds (shared constants).
- Column cells: empty / „—" / badge / „Anulowana".

### Integration Tests (DB, 5435 via `pnpm test:integration` discovery):

- Create-time default on every booking path shape; update cannot overwrite a decision; CHECK
  refuses malformed states.
- Ownership and race guards on both decisions; the 14-day cancelled window; the rejected count.

### DOM Tests:

- The worker block's per-status affordances and both dialogs' gating.

### E2E:

- Not authored here. The risk crosses client → action → DB → revalidation (decision visible to
  management without reload — test-plan risk #17); if the review gate wants it, file it under the
  `e2e-backlog` label.

### Manual Testing Steps:

1. Book a wypłata to a worker with a login; log in as him at 390px; accept it; confirm the status
   and date on `/wyplaty`.
2. Book another; reject it with a reason; see it pinned on `/` and counted on „Wypłaty"; „Zweryfikuj"
   → cancel; it leaves the queue; the worker sees „Anulowana".
3. Book a third; reject; as the worker accept it later; the reason stays, the queue empties.

## Performance Considerations

All new reads are single-index-friendly scans over `transactions` filtered by `type = 'PAYOUT'` and
`worker_id` / `payout_status` (~700 PAYOUT rows today). No index needed at this scale; the dashboard
and the worker page each add one uncached query.

## Migration Notes

Additive: migrate prod (human, `pnpm db:migrate:prod`) **before** pushing the code that reads the
columns. Run `pnpm db:migrate:preview` before staging QA. Legacy rows stay `NULL` by design.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Touched specs + DB integration specs pass: `pnpm test:integration` (full `pnpm test` only when asked)
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-10-11-worker-payout-confirmation/research.md`
- Rulings: `context/changes/2026-10-11-worker-payout-confirmation/change.md`
- Fixed-scope transfers page: `src/app/(frontend)/kasa/[id]/page.tsx:36-45`
- Queue + pinned block: `src/components/worker-expenses/pending-expense-drafts.tsx`, `src/components/nav/unread-badge.tsx:16`
- Ownership/race guard: `src/lib/db/worker-expense-drafts.ts:580-596`
- Reason dialog: `src/components/transfers/cancel-transfer-button.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and booking default

#### Automated

- [x] 1.1 Migration applies to the local DB
- [x] 1.2 Payout status default DB spec passes
- [x] 1.3 Existing transfer-mapping / card specs pass

### Phase 2: The worker's decision (server)

#### Automated

- [x] 2.1 Payout confirmation DB spec passes
- [x] 2.2 Payout confirmation action spec passes

### Phase 3: Worker UI

#### Automated

- [x] 3.1 Payouts-to-confirm DOM spec passes
- [x] 3.2 Existing cancellation dialog spec still passes

### Phase 4: Management surfaces

#### Automated

- [x] 4.1 Transfer filter spec passes
- [x] 4.2 where-to-sql spec passes
- [x] 4.3 Transfers column spec passes
- [x] 4.4 Unread counts spec passes
