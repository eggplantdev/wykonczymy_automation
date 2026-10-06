# Historia zgłoszeń wydatków — Implementation Plan

## Overview

Give worker expense drafts a history. Managers get a new page „Zgłoszenia wydatków”
(`/zgloszenia-wydatkow`), a variant of `/zgloszenia-prac`. The worker page replaces its ever-growing
„Moje zgłoszenia wydatków” `SummaryTable` with the same TanStack table, paged 10 at a time in the
browser. The manager Transakcje list loses the rejected-draft rows and the „Zgłoszenia” toggle, and
the worker page's transfers default to the 20 newest.

Decisions: `change.md` § „Decyzje” and § „Decyzje po researchu”. Codebase map: `research.md`.

## Current State Analysis

- `/zgloszenia-prac` is the complete template:
  - page → `fetchWorkerReportsPage` (`src/lib/queries/worker-reports-list.ts`) → `listDecidableReports`,
    `listReportFilterOptions` and `countPendingReports` (`src/lib/db/worker-reports.ts:281-393`);
  - URL filters/sort parsers (`worker-report-filters.ts`, `worker-report-sort.ts` + whitelist
    `sortable-columns.ts`);
  - `WorkerReportsDataTable` (shared `DataTable` + `PaginationFooter`);
  - a `NAV_LINKS` entry with the `workerReports` queue badge.
- Drafts (`src/lib/db/worker-expense-drafts.ts`):
  - `ExpenseDraftRowT` has no decider name, transfer amount or transfer investment.
  - `listWorkerExpenseDrafts` returns all of a worker's drafts with no trash rule.
  - `listRejectedExpenseDrafts` feeds the rejected rows on Transakcje.
  - `PARTIES_NOT_TRASHED` guards restore.
- The „Zobacz” accept flow is not reusable as-is. Its state, its two dialogs (prefilled
  `ExpenseForm`, reject confirm) and the AI read on open all live inside the pinned block
  `PendingExpenseDrafts` (`src/components/worker-expenses/pending-expense-drafts.tsx`).
- „Przywróć” (`restore-expense-draft-button.tsx`) has one host: the rejected rows on Transakcje,
  which this change removes.
- `UrlPagination` (`src/components/ui/url-pagination.tsx`) builds every page link from the URL.
  There is no state-driven pagination, and `DataTable` has no client pagination.
- The worker page (`src/app/(frontend)/pracownicy/[id]/page.tsx:46`) calls `parsePagination(sp)`,
  so it defaults to 100 transfers.

## Desired End State

- **`/zgloszenia-wydatkow` (management only).**
  - Columns: pracownik, inwestycja, wysłano, zdjęcia, notatka, status, decyzja (kiedy · kto), wydatek.
  - Filters: status, pracownik, inwestycja, data wysłania.
  - URL sort and pagination, pending drafts first.
  - A pending row's „Zobacz” opens the same accept dialog as the pinned block on Transakcje.
  - A rejected row has „Przywróć”.
  - An accepted row's amount links to `/inwestycje/<transfer investment>?id=<transferId>`.
- **Nav entry** „Zgłoszenia wydatków” right after „Zgłoszenia wykonanych prac”, with a queue badge
  counting pending drafts.
- **Worker page `/pracownicy/[id]`.**
  - The drafts section shows the same columns minus „Pracownik”, 10 rows per page, paged with local
    state (the URL stays untouched).
  - The amount is not a link.
  - Edytuj / Usuń and the editable photos cell appear on the worker's own pending drafts.
  - Transfers default to 20 per page.
  - The page is translated pl/uk/ru.
- **Manager Transakcje.**
  - The pinned pending block and the „od pracownika” badge are unchanged.
  - No rejected-draft rows and no „Zgłoszenia” toggle.
- **Trash rule.**
  - A rejected draft whose pracownik, inwestycja or kasa is in the trash is hidden from both lists.
  - An accepted draft is always listed.

### Key Discoveries:

- Queue order and sort mechanics to mirror: `QUEUE_ORDER`, `SORT_EXPRESSIONS` and `reportsOrderBy`,
  `src/lib/db/worker-reports.ts:297-316`.
  - An explicit sort replaces pending-first.
  - `status` sorts semantically via `array_position`.
- Filter facets ignore the URL: `listReportFilterOptions`, `worker-reports.ts:364-384`.
- `transfer_id` references `transactions` with `ON DELETE SET NULL`
  (`src/migrations/20261005_3_add_worker_expense_drafts.ts`). An accepted draft can therefore have
  no transfer, and its „Wydatek” cell must render `—`.
- `investmentTransfersHref(investmentId, { id })` (`src/lib/utils/investment-transfers-href.ts`) is
  the link contract the kosztorys summary uses (`deposits-table.tsx:70`).
  - The investment page parses `id` through `buildTransferFilters`
    (`src/app/(frontend)/inwestycje/[id]/page.tsx:44`).
  - Pass **no `types`**: the manager picks the type in the accept dialog, and the helper's own
    comment warns that a guessed type filters out the linked row.
- `isActiveLink` already uses the `${href}/` boundary (`src/hooks/use-nav-links.ts:10-12`). So
  `/zgloszenia`, `/zgloszenia-prac` and `/zgloszenia-wydatkow` don't light each other up, but only
  the existing badge test proves it.
- Worker-page scope is forced server-side, never taken from the URL
  (`context/archive/2026-10-05-worker-account/change.md:59-67`).

## What We're NOT Doing

- No filters, sort or URL state on the worker-page drafts table.
- No per-worker filter on Transakcje.
- No change to the pinned pending block or the „od pracownika” badge.
- No mobile column-visibility changes. The table scrolls horizontally at 390px.
- No fix for the „several lines → only the first transfer is linked” limitation (EX-971 review-gate
  :26).
- No AI-status indicator on the manager page (`worker-expense-ai-prefill/plan.md:63`).
- No cache tags. Drafts reads stay uncached, and freshness comes from `router.refresh()`.
- No schema change and no migration.

## Implementation Approach

This is a variant of the `/zgloszenia-prac` path, with no new mechanics.

- The SQL list, count, facets and badge count go next to the existing draft statements.
- A management-checked uncached fetcher goes in `lib/queries`.
- The client is `DataTable` + `PaginationFooter` + a filters component.
- One column factory serves both pages. The worker page differs only in options: no worker column,
  a plain amount, edit actions.
- The two pieces that don't exist yet are extracted from their single current owner rather than
  copied:
  - the accept/reject dialogs, from `PendingExpenseDrafts`;
  - the windowed page-number rendering, from `UrlPagination`.

## Critical Implementation Details

- **Two different „inwestycja” on one row.**
  - The table's Inwestycja column is the draft's investment, what the worker reported.
  - The „Wydatek” link targets the **transfer's** investment, because the manager may have changed
    it while accepting.
  - Select `t.investment_id` alongside `t.amount` and never build the link from `d.investment_id`.
- **The trash rule is status-specific.** Use
  `(d.status <> 'rejected' OR ${PARTIES_NOT_TRASHED})` and nothing broader. A pending draft blocks
  its parties' trash already (`pendingDraftsProbe`), and an accepted one is a booked expense that
  must stay visible.

## Phase 1: Data layer

### Overview

Add the history list, facets and pending count for drafts. Widen the row with decider, amount and
transfer investment. Apply the trash rule to the worker's history too.

### Changes Required:

#### 1. Row shape and select

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Every list carries what the „Decyzja” and „Wydatek” columns need.

**Contract**:

- `ExpenseDraftRowT` gains:
  - `decidedByName: string | null`
  - `transferAmount: number | null`
  - `transferInvestmentId: number | null`
- `DRAFT_SELECT` adds `LEFT JOIN users dec ON dec.id = d.decided_by` and
  `LEFT JOIN transactions t ON t.id = d.transfer_id`.
- Existing callers (`listPendingExpenseDrafts` and others) keep working unchanged.

#### 2. History list, facets, badge count

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Mirror `listDecidableReports`, `listReportFilterOptions` and `countPendingReports` for
drafts.

**Contract**:

- `ExpenseDraftFiltersT = { statuses, investmentIds, workerIds, sentRange }`.
  - `null` = unfiltered; `[]` = match nothing (same semantics as `WorkerReportFiltersT`).
- `listExpenseDraftHistory(db, filters, { page, limit }, sort?) → { rows, totalDocs }`.
  - Default order: `d.status <> 'pending', d.sent_at DESC, d.id DESC`.
  - Whitelisted sort expressions: `workerName`, `investmentName`, `sentAt`, `status` (semantic via
    `array_position` over `EXPENSE_DRAFT_STATUSES`), `decidedAt`.
  - Ties: newest first.
  - WHERE includes the trash rule from Critical Implementation Details.
- `listExpenseDraftFilterOptions(db) → { investments, workers }`.
  - Distinct parties of listed drafts, ignoring the URL.
  - Same trash rule.
- `countPendingExpenseDrafts(db) → number`.
  - Same predicate as `listPendingExpenseDrafts`, so the badge and the pinned block agree.
- `listWorkerExpenseDrafts` gains the trash rule. It stays unpaged: the worker's full history.

#### 3. Sort whitelist and URL parsers

**Files**:

- `src/lib/constants/worker-expense-drafts.ts`
- `src/lib/queries/expense-draft-filters.ts` (new)
- `src/lib/queries/expense-draft-sort.ts` (new)

**Intent**: One whitelist shared by SQL and the table header state, as in lessons.md:1755-1770.

**Contract**:

- `SERVER_SORTABLE_DRAFT_COLUMNS` + `isServerSortableDraftColumn`.
- `isExpenseDraftStatus`.
- `parseExpenseDraftFilters(sp)` and `parseExpenseDraftSort(sp)` / `validExpenseDraftSort(param)`.
  These copy the shapes of the `worker-report-*` files.

#### 4. Fetchers

**File**: `src/lib/queries/worker-expense-drafts.ts`

**Intent**: Uncached and management-checked, like `fetchWorkerReportsPage`.

**Contract**:

- `fetchExpenseDraftsPage(filters, pagination, sort) → { rows, paginationMeta, investments, workers }`.
- Reuse `managementDb()` from `worker-reports-list.ts`.

### Success Criteria:

#### Automated Verification:

- Parser unit specs pass: `pnpm exec vitest run src/__tests__/lib/queries/expense-draft-filters.test.ts src/__tests__/lib/queries/expense-draft-sort.test.ts`
- DB spec passes against the 5435 test DB:
  `set -a; . ./.env; set +a; DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts`.
  New cases:
  - pending first, then newest;
  - filters + paging + `totalDocs`;
  - facets ignore filters;
  - unknown sort falls back to queue order;
  - decider name, amount and transfer investment come back;
  - an accepted draft whose transfer was rebooked to another investment returns that investment;
  - a rejected draft with a trashed kasa is hidden from history, facets and the worker list;
  - an accepted draft with a trashed investment stays visible;
  - `countPendingExpenseDrafts` equals `listPendingExpenseDrafts().length`.

#### Manual Verification:

- None. This phase has no UI yet.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Manager page „Zgłoszenia wydatków”

### Overview

Add the new page, its nav entry and badge, and the shared columns. Extract the accept dialogs so
„Zobacz” works from both the pinned block and the new page, and move „Przywróć” here.

### Changes Required:

#### 1. Accept/reject flow extraction

**Files**:

- `src/components/worker-expenses/use-expense-draft-acceptance.tsx` (new)
- `src/components/worker-expenses/pending-expense-drafts.tsx`

**Intent**: The new page offers „Zobacz” with exactly the pinned block's behavior: page download,
prefilled `ExpenseForm`, the AI read on open, „Odrzuć” with confirm. That logic should have one
owner.

**Contract**:

- `useExpenseDraftAcceptance(referenceData) → { open(draft), loadingId, dialogs: ReactNode }`.
- Moved verbatim from `PendingExpenseDrafts`: state, `prefillFor`, `downloadPages`, `readOnOpen`,
  `handleReject`, both dialogs.
- `PendingExpenseDrafts` becomes table + hook.
- The existing `pending-expense-drafts.test.tsx` passes unchanged.

#### 2. Shared column factory

**File**: `src/components/tables/expense-drafts.tsx` (new)

**Intent**: One set of columns for both pages. Headers come from the `expenseDrafts` namespace
because the worker page is translated; without a provider it falls back to Polish.

**Contract**:

- `useExpenseDraftColumns({ showWorker, linkTransfer, actions? })`.
- Accessor ids = sortable ids.
- Columns:
  - zdjęcia: `MediaPreviewButton`, or the editable `ExpenseDraftPagesCell` when an `actions` option
    marks the row editable;
  - status: `DraftStatusBadge`;
  - decyzja: `formatPLDateTime(decidedAt) · decidedByName`, `—` while pending;
  - wydatek: `formatPLN(transferAmount)`.
    - With `linkTransfer` and a `transferId`, it is a `Link` to
      `investmentTransfersHref(transferInvestmentId, { id: transferId })`.
    - `—` when there is no transfer.
- The actions cell is supplied by the caller (render prop).
- New `expenseDrafts` keys go in pl/uk/ru: `worker`, `decision`, `expense`.

#### 3. Page, table, filters

**Files**:

- `src/app/(frontend)/zgloszenia-wydatkow/page.tsx` + `loading.tsx` (new)
- `src/components/worker-expenses/expense-drafts-data-table.tsx` (new)
- `src/components/worker-expenses/expense-draft-filters.tsx` (new)

**Intent**: A copy of the `/zgloszenia-prac` shape.

**Contract**:

- The page calls `requireManagementPage()`, then `fetchExpenseDraftsPage(...)` + `fetchReferenceData()`
  (needed by the accept dialog).
- `PageWrapper title={PAGE_TITLES.expenseDrafts}`, with a `Description` explaining the default order.
- `DataTable storageKey="expense-drafts"`, controlled URL sort, `PaginationFooter`.
- Filters: `FilterMultiSelect` ×3 (status, pracownik, inwestycja) + `DateFilters` + `ClearButton`.
- Actions column:
  - pending → „Zobacz” (`open(draft)`, spinner on `loadingId`);
  - rejected → `RestoreExpenseDraftButton`.
- No `getRowHref`.

#### 4. Nav and badge

**Files**:

- `src/lib/constants/sections.ts`
- `src/types/notifications.ts`
- `src/lib/queries/unread-counts.ts`
- `src/components/nav/unread-badge.tsx`

**Intent**: Same queue-badge treatment as `workerReports`.

**Contract**:

- `PAGE_TITLES.expenseDrafts = 'Zgłoszenia wydatków'`.
- `NAV_LINKS` entry `/zgloszenia-wydatkow`, placed after `/zgloszenia-prac`, with an icon
  (lucide `ReceiptText` or nearest unused).
- `UnreadStreamT` gains `'expenseDrafts'`.
- `fetchUnreadCounts` calls `countPendingExpenseDrafts`, and `NONE` gets the new key.
- `QUEUE_STREAMS` gains `'expenseDrafts'`.

### Success Criteria:

#### Automated Verification:

- Pinned block is unchanged after the extraction: `pnpm exec vitest run src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx`
- Columns DOM spec passes: `pnpm exec vitest run src/__tests__/components/tables/expense-drafts.test.tsx`
  - the manager variant links an accepted row to `/inwestycje/<transferInvestmentId>?id=<transferId>`;
  - the worker variant renders the same amount as plain text;
  - a transfer-less accepted row shows `—`;
  - a pending row shows `—` in „Decyzja”.
- Badge spec passes, with a case that `/zgloszenia-wydatkow` doesn't mark `/zgloszenia` or
  `/zgloszenia-prac` active and the pending count shows on its own page:
  `pnpm exec vitest run src/__tests__/components/nav/unread-badge.test.tsx`.

#### Manual Verification:

- „Zgłoszenia wydatków” appears in the sidebar and in the mobile menu after „Zgłoszenia wykonanych
  prac”. Its badge equals the number of pending drafts and stays when the page is open.
- Without a sort, pending drafts are on top and the rest are newest first. A sort by Status, then
  Pracownik, reorders across pages. Each filter (status, pracownik, inwestycja, od/do) narrows the
  list, and „Wyczyść” resets it.
- „Zobacz” on a pending row opens the prefilled „Nowy wydatek” dialog with the AI read.
  - Saving turns the row „Przyjęte”, with Decyzja = now · me and the amount.
  - „Odrzuć” turns it „Odrzucone”.
- „Przywróć” on a rejected row returns it to „Czeka” on top.
- The amount on an accepted row opens that investment's transactions with only this transaction
  listed and the ID field filled. This includes a draft whose investment was changed in the dialog.
- A rejected draft of a worker in `/kosz` isn't listed. An accepted draft of a trashed investment is.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Worker page

### Overview

Swap the `SummaryTable` for the shared table with client pagination of 10, and default transfers
to 20.

### Changes Required:

#### 1. State-driven pagination

**Files**:

- `src/components/ui/url-pagination.tsx`
- `src/components/ui/pagination/page-nav.tsx` (new)

**Intent**: Local-state paging needs the same windowed page-number control. Extract the rendering
so the URL and the state variants share it instead of copying it.

**Contract**:

- `PageNav({ currentPage, totalPages, renderLink(page, children) })`, or an equivalent seam taking
  either an href builder or an `onSelect`.
- `UrlPagination` becomes a thin wrapper over it.
- Its rendered output is unchanged, so existing specs still pass.

#### 2. Drafts section

**File**: `src/components/worker-expenses/worker-expense-drafts-section.tsx` (+ a client table
component beside it, `worker-expense-drafts-table.tsx`)

**Intent**: Same `CollapsibleSection` (title, hint, „Dodaj wydatek” action, empty states).

**Contract**:

- The table uses `useExpenseDraftColumns({ showWorker: false, linkTransfer: false, actions })`.
  - Edytuj / Usuń + the editable photos cell only when `canSend` and the row is pending.
  - The actions column is hidden when nothing is pending, as today.
- Rows are sliced 10 per page from `useState`, with `PageNav` below when there is more than one
  page.
- Not sortable. Distinct `storageKey="worker-expense-drafts"`.
- Nothing is written to the URL.

#### 3. Transfers default

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: The worker's phone page loads 20 transfers, not 100.

**Contract**: `parsePagination(sp, 20)`. The „Pokaż” select still offers 20/50/100.

### Success Criteria:

#### Automated Verification:

- Client paging DOM spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`
  - 25 drafts → 10 rows; page 2 → the next 10; page 3 → 5;
  - Edytuj / Usuń only on pending rows of the own page;
  - the amount is not a link.
- Existing pagination and language specs still pass: `pnpm exec vitest run src/__tests__/components/ui src/__tests__/components/worker-expenses`

#### Manual Verification:

- Own page as EMPLOYEE at 390px:
  - „Moje zgłoszenia wydatków” shows 10 rows and the page switch, and the table scrolls sideways
    inside its container.
  - Switching drafts pages doesn't change the URL or move the transfers section.
  - Decyzja and Wydatek are visible and the amount isn't clickable.
- Edytuj / Usuń and photo edits work on a pending draft. A decided one has no actions.
- The language set to Українська translates the new headers.
- Transakcje on the worker page show 20 rows by default, and „Pokaż 50” works.
- A manager on a worker's page sees the same table, without Edytuj / Usuń.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Clean Transakcje

### Overview

Remove the rejected-draft rows and the `workerDrafts` toggle, with their code, strings and tests,
and update the manual-checks registry.

### Changes Required:

#### 1. Removal

**Files**: per `research.md` §3:

- `manager-dashboard.tsx`
- `transfer-table-server.tsx`
- `transfer-table-config.ts`
- `src/lib/transfers/rejected-draft-row.ts` (delete)
- `src/types/transfers.ts` (`rejectedDraftId`)
- `src/components/tables/transfers.tsx` (rejected rendering)
- `transfer-data-table.tsx` (line-through)
- `src/lib/queries/transfer-filters.ts` (`TRANSFER_ONLY_PARAMS`, `buildRejectedDraftScope`,
  `narrowToTransferIds`, now-unused imports)
- `transfer-filters.tsx` + `src/types/filters.ts` (toggle)
- `fetchRejectedExpenseDrafts`, `listRejectedExpenseDrafts`, `RejectedDraftScopeT`,
  `REJECTED_DRAFTS_LIMIT`
- i18n `rejectedDraft` and `filterWorkerDrafts` (pl/uk/ru)

**Intent**: Transakcje lists transactions plus the pinned pending block, nothing else.

**Contract**:

- Keep `fetchPendingExpenseDrafts` + `<PendingExpenseDrafts>`.
- Keep the `fromWorkerDraft` badge path (`fetchDraftTransferIds(ids)`).
- `listDraftTransferIds` keeps its id-list form. Drop the no-arg form if typecheck shows no other
  caller.
- `PARTIES_NOT_TRASHED` stays (restore + history).

#### 2. Tests

**Files**:

- `src/__tests__/lib/queries/transfer-filters.test.ts` (drop the :259-317 cases)
- `src/__tests__/lib/db/worker-expense-drafts.db.test.ts`:
  - drop rejected-under-transfer-filters :176-222;
  - keep the restore half of :254-282, re-pointing its listing assertion at
    `listExpenseDraftHistory`.

#### 3. Docs

**Files**:

- `context/foundation/manual-checks.md` § EX-971
- `AGENTS.md` / `context/` only if a statement becomes false

**Intent**: Retire the checks this change invalidates and re-point the rest at the new page.

**Contract**:

- Invalidated: :3839, :3841, :3843, :3851, :3861, :3865 (filter half), :3867.
- Re-point: :3817, :3825, :3827, :3853-3857, :4134-4138.

### Success Criteria:

#### Automated Verification:

- Transfer filters spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts`
- DB spec passes against 5435 (command as in Phase 1).
- No leftover references: `grep -rn "workerDrafts\|rejectedDraft\|REJECTED_DRAFTS_LIMIT\|buildRejectedDraftScope" src` returns nothing.

#### Manual Verification:

- Manager Transakcje:
  - pending drafts are still pinned on top with „Zobacz”;
  - an accepted one shows „od pracownika”;
  - no rejected rows on page 1;
  - no „Zgłoszenia” toggle in the filters;
  - `/?workerDrafts=1` renders the normal list.

**Implementation Note**: When this phase's automated verification passes, commit.

---

## Testing Strategy

### Unit Tests:

- URL parsers: status whitelist, numeric ids, `[]` vs `null`, unknown sort → `undefined`.

### Integration Tests:

- DB spec (Phase 1): order, filters, paging, facets, the trash rule in both directions, the transfer
  investment ≠ draft investment case, badge parity.

### DOM Tests:

- Column factory variants (link vs plain amount, `—` cases).
- Worker table client paging.
- Pinned block unchanged after the hook extraction.

### Manual Testing Steps:

The phases' Manual Verification lists, run on staging with a manager and the QA EMPLOYEE
(`pnpm qa:staging-user`).

## Performance Considerations

- The history query joins `users` twice and `transactions` once, on indexed keys
  (`worker_expense_drafts_transfer_idx`). The count query needs only the joins the WHERE uses.
- The worker page loads one worker's full history, hundreds of rows at most, which is the accepted
  trade-off for no URL state.

## Migration Notes

None. No schema change.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- DB integration passes: `pnpm test:integration`

## References

- Change decisions: `context/changes/2026-10-06-worker-expense-drafts-history/change.md`
- Research: `context/changes/2026-10-06-worker-expense-drafts-history/research.md`
- Template: `src/app/(frontend)/zgloszenia-prac/page.tsx`, `src/lib/db/worker-reports.ts:281-393`
- Link contract: `src/lib/utils/investment-transfers-href.ts`, `src/components/kosztorys/summary/tables/deposits-table.tsx:70`
- Manual checks to mirror: `context/foundation/manual-checks.md:3642-3663` (EX-955)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer

#### Automated

- [x] 1.1 Parser unit specs pass — 5aa77fa7
- [x] 1.2 DB spec passes against the 5435 test DB — 5aa77fa7

### Phase 2: Manager page „Zgłoszenia wydatków”

#### Automated

- [x] 2.1 Pinned block unchanged after extraction
- [x] 2.2 Columns DOM spec passes
- [x] 2.3 Badge spec passes with the prefix case

### Phase 3: Worker page

#### Automated

- [ ] 3.1 Client paging DOM spec passes
- [ ] 3.2 Existing pagination and language specs still pass

### Phase 4: Clean Transakcje

#### Automated

- [ ] 4.1 Transfer filters spec passes
- [ ] 4.2 DB spec passes against 5435
- [ ] 4.3 No leftover references
