---
date: 2026-10-06T15:25:07+0200
researcher: Claude (Opus 5.5)
git_commit: 8ade8dd9
branch: staging
repository: wykonczymy
topic: 'Historia zgłoszeń wydatków — strona menedżera + ta sama tabela na stronie pracownika, domyślne limity strony pracownika'
tags: [research, codebase, worker-expense-drafts, data-table, pagination, nav-badge, worker-page]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
---

# Research: Historia zgłoszeń wydatków

**Date**: 2026-10-06T15:25:07+0200
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 8ade8dd9
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does it take to build (per `change.md`): a manager page „Zgłoszenia wydatków” modelled on
`/zgloszenia-prac`; the same TanStack table on `/pracownicy/[id]` replacing the „Moje zgłoszenia
wydatków” `SummaryTable`; removal of the rejected-drafts rows and the `workerDrafts` toggle from the
manager Transakcje list (pinned pending block and „od pracownika” badge stay); worker-page defaults of
20 transfers and 10 drafts?

## Summary

- **The template is complete and copyable.** `/zgloszenia-prac` is page → `fetchWorkerReportsPage`
  (uncached, management-only) → `listDecidableReports` (one rows query with `LIMIT/OFFSET` + one
  `count(*)`, queue order `status <> 'pending', sent_at DESC, id DESC`) + `listReportFilterOptions`
  (facets that ignore the URL) → `WorkerReportsDataTable` (shared `DataTable`, `PaginationFooter`,
  URL sort through a whitelist) + nav entry with a queue badge. No cache tags exist anywhere on that
  path, and none on the drafts path either — both rely on uncached reads + `router.refresh()`.
- **Blocker 1 — two URL-paginated tables cannot share the worker page today.** `page`, `limit`,
  `sort` are hard-coded in `parsePagination`, `PaginationFooter`, `UrlPagination`,
  `useUrlFilterParams` (resets `page` on every write) and every sort consumer; `investment` and
  `from`/`to` are also read by the transfers filters. No namespacing mechanism and no precedent of
  two paginated tables on one page exist.
- **Blocker 2 — 10 is not an allowed page size.** `ALLOWED_LIMITS = [20, 50, 100]`
  (`src/lib/utils/pagination.ts:16`); `parsePagination(sp, defaultLimit)` accepts a default only from
  that list, because the „Pokaż” select lists only those. 20 for transfers works as-is.
- **Row data gaps.** `ExpenseDraftRowT` lacks `decided_by` (name), the cash-register name and the
  accepted transfer's amount — needed by the planned „Decyzja” and „Wydatek” columns.
- **Removal is clean and well-bounded** (§3) — except that „Przywróć” loses its only host; it moves to
  the new manager page.
- **Restore + trash invariant must carry over:** a rejected draft whose worker/investment/register is
  trashed must be hidden from any list that offers „Przywróć” (`PARTIES_NOT_TRASHED`, lessons.md
  :2540-2545).
- **Worker-page scope must be forced server-side** and combined with URL filters by `and`, never a
  spread (`context/archive/2026-10-05-worker-account/change.md:59-67,111-112`).

## Detailed Findings

### 1. Template: `/zgloszenia-prac`

- Page `src/app/(frontend)/zgloszenia-prac/page.tsx:12-33` — `requireManagementPage()`
  (`src/lib/auth/require-management-page.ts:13-17`), `fetchWorkerReportsPage(parseWorkerReportFilters(sp),
parsePagination(sp), parseWorkerReportSort(sp))`, `<PageWrapper title={PAGE_TITLES.workerReports}>`,
  `<Description>` explaining the default order. `loading.tsx:4-5` → `TitledPageLoading` with the same
  `PAGE_TITLES` key (`src/lib/constants/sections.ts:21-28`). Route protection by `proxy.ts` is automatic.
- Query `src/lib/queries/worker-reports-list.ts:18-51` — `managementDb()` re-checks
  `MANAGEMENT_ROLES`; `Promise.all([listDecidableReports, listReportFilterOptions])`; builds
  `paginationMeta` by hand (`totalPages = max(1, ceil(totalDocs/limit))`).
- Filters `src/lib/queries/worker-report-filters.ts:8-17` — `status` (whitelist), `investment`,
  `worker` (`parseNumericIds`), `from`/`to` (`dayBound`); `listParam` gives `null` = no filter,
  `[]` = match nothing.
- Sort `src/lib/queries/worker-report-sort.ts:10-18` + whitelist
  `src/lib/kosztorys/worker-report/sortable-columns.ts:1-15`; unknown → `undefined` → queue order
  (lessons.md:1755-1770: one whitelist, never pass raw `?sort=`).
- DB `src/lib/db/worker-reports.ts` — `decidableReportsWhere` :286-295 (`inList` from
  `src/lib/db/sql-list.ts:14-20`, `warsawDayWithin` from `src/lib/db/sql-warsaw-day.ts:9-15`);
  `QUEUE_ORDER` :297; `SORT_EXPRESSIONS` :299-306 (`status` via `array_position` = semantic order);
  `reportsOrderBy` :310-316 (an explicit sort REPLACES the pending-first rule);
  `listDecidableReports` :322-358; facets `listReportFilterOptions` :364-384;
  `countPendingReports` :386-393 (badge).
- Client `src/components/worker-reports/worker-reports-data-table.tsx:18-49` — `DataTable` with
  `storageKey="worker-reports"`, controlled URL sort, `getRowHref`, `PaginationFooter`;
  filters component `worker-report-filters.tsx:13-72` (3× `FilterMultiSelect`, `ClearButton`,
  `DateFilters`); columns `src/components/tables/worker-reports.tsx:8-26` (accessor ids = sortable ids).
- Nav — `NAV_LINKS` `src/lib/constants/sections.ts:50-67` (entry :60-65, `unreadStream:
'workerReports'`); `UnreadStreamT` `src/types/notifications.ts:1-3`; `fetchUnreadCounts`
  `src/lib/queries/unread-counts.ts:15,22-37`; `QUEUE_STREAMS` `src/components/nav/unread-badge.tsx:16`
  (queue badges aren't zeroed on their own page); one `NAV_LINKS` entry feeds desktop sidebar and
  mobile menu. Badge prefix match uses the `${href}/` boundary
  (`context/archive/2026-09-30-worker-work-reports/change.md:274-277`) — relevant because
  `/zgloszenia`, `/zgloszenia-prac` and a new `/zgloszenia-wydatkow` share a prefix.
- Tests to mirror: `src/__tests__/lib/queries/worker-report-filters.test.ts`,
  `src/__tests__/lib/queries/worker-report-sort.test.ts`, `src/__tests__/lib/db/worker-reports.test.ts`
  (:188 pending first, :215 filters + paging + facets, :262 sort across pages / injection fallback),
  `src/__tests__/components/nav/unread-badge.test.tsx:37`.

### 2. Worker expense drafts — current state

- Row `src/lib/db/worker-expense-drafts.ts:14-29` (`ExpenseDraftRowT`): `id, workerId, workerName,
investmentId, investmentName, cashRegisterId, note, status, sentAt, decidedAt, transferId, media[],
scanMode, aiRead`. `DRAFT_SELECT` :41-48 joins only `users w` + `investments i`. **Missing:**
  decider name (`decided_by` not selected), register name, transfer amount.
- Lists: `listWorkerExpenseDrafts` :134 (all statuses, newest first, no LIMIT);
  `listPendingExpenseDrafts` :146 (oldest first, investment not trashed, no LIMIT);
  `listRejectedExpenseDrafts` :170-189 (the only LIMIT — `REJECTED_DRAFTS_LIMIT = 20`,
  `src/lib/constants/worker-expense-drafts.ts:15`); `listDraftTransferIds` :379-390.
  No filtered + paged + counted list, no facets function.
- `PARTIES_NOT_TRASHED` :164-168 — used by the rejected list and by `restoreRejectedExpenseDraft` :215.
- Media on accept: `decideExpenseDraft` :195 only updates the draft row; the draft keeps its
  `worker_expense_draft_media` rows, the dialog re-uploads the photos as new media for the transfer
  (`src/components/worker-expenses/pending-expense-drafts.tsx:92-98`). So an accepted draft still has
  its photos for a history row.
- Accept = `createBulkTransferAction` `src/lib/actions/transfers.ts:89-184` (revalidates
  `['transfers']`, :182; calls `decideExpenseDraft(... transferId: ids[0])` :155-163). **A draft
  accepted as several lines links only the first transfer**
  (`context/archive/2026-10-05-worker-expenses/review-gate.md:26`, skipped finding).
- Queries `src/lib/queries/worker-expense-drafts.ts` — all uncached by design (:17, :26):
  `fetchWorkerExpenseDrafts` :18 (`canViewWorkerPage`), `fetchPendingExpenseDrafts` :27,
  `fetchRejectedExpenseDrafts` :34-45, `fetchDraftTransferIds` :47-52.
- Actions `src/lib/actions/worker-expense-drafts.ts` — reject :92, read :105, restore :114
  (`protectedAction`); send :66, delete :127, add/remove pages :139/:164, update :181 (`sessionAction`,
  scoped `worker_id = me AND status = 'pending'`). None revalidates tags; clients `router.refresh()`.
- Components `src/components/worker-expenses/`:
  - `worker-expense-drafts-section.tsx` — server; `createTranslator(locale, 'expenseDrafts')` :42;
    `CollapsibleSection storageKey="worker:expenseDrafts"` :53; header action = „Dodaj wydatek”
    (`ExpenseDraftDialog` without draft) :55-65; `SummaryTable` :72 with Inwestycja / Wysłano /
    Załączniki / Notatka / Status / actions (edit + delete, only `canSend` and any pending) :100-116.
  - `pending-expense-drafts.tsx` — client, hardcoded Polish; pinned block „Wydatki zgłoszone przez
    pracowników” :153; „Zobacz” :113-137 opens prefilled `ExpenseForm` and triggers AI read; „Odrzuć”.
  - `expense-draft-dialog.tsx`, `delete-expense-draft-button.tsx`, `draft-status-badge.tsx`,
    `expense-draft-pages-cell.tsx` — translated (`useTranslation('expenseDrafts')`).
  - `restore-expense-draft-button.tsx` — hardcoded Polish; manager only.
- i18n: `expenseDrafts` namespace `src/lib/i18n/dictionaries/pl.ts:113-158`, `uk.ts:105`, `ru.ts:104`.

### 3. To remove from the manager Transakcje list

- `src/components/dashboard/manager-dashboard.tsx` — :33 `showWorkerDrafts`, :34
  `buildRejectedDraftScope`, :47-48, :53 `fetchDraftTransferIds()` (no-arg = the filter path), :54
  `fetchRejectedExpenseDrafts`, :77 `narrowToTransferIds`, :83 `rejectedDrafts`, :98
  `showWorkerDraftsFilter`. **Keep** :51 `fetchPendingExpenseDrafts` + :63-70 `<PendingExpenseDrafts>`.
- `src/components/transfers/transfer-table-server.tsx` :16, :25, :71-76 (rejected rows prepended on
  page 1). **Keep** :14, :66-70, :75 (`fromWorkerDraft` badge via `fetchDraftTransferIds(ids)`).
- `src/components/transfers/transfer-table-config.ts:6,37-38`; `src/lib/transfers/rejected-draft-row.ts`
  (whole file); `src/types/transfers.ts:49-51` (`rejectedDraftId`).
- `src/components/tables/transfers.tsx` :12, :46, :59-60, :114-116, :147-152, :250-256 (rejected-row
  rendering + Restore); `src/components/transfers/transfer-data-table.tsx:94` (line-through).
- `src/lib/queries/transfer-filters.ts` :7, :168-176 `TRANSFER_ONLY_PARAMS`, :178-195
  `buildRejectedDraftScope`, :197-204 `narrowToTransferIds`; imports `dayBound` :5 / `listParam` :6
  become unused there.
- `src/components/transfers/transfer-filters.tsx` :52, :74, :97-100, :151, :249-255;
  `src/types/filters.ts:14`.
- `src/lib/queries/worker-expense-drafts.ts:34-45` + `REJECTED_DRAFTS_LIMIT`; DB
  `listRejectedExpenseDrafts` / `RejectedDraftScopeT` (keep `PARTIES_NOT_TRASHED` for restore — and
  reuse it in the new history list).
- i18n `transfers` ns: `rejectedDraft` (pl :296 / uk :284 / ru :285), `filterWorkerDrafts`
  (pl :325 / uk :313 / ru :314). `fromWorker` stays.
- Tests: `src/__tests__/lib/queries/transfer-filters.test.ts:4,6,259-317`;
  `src/__tests__/lib/db/worker-expense-drafts.db.test.ts:176-222` (rejected under transfer filters),
  :254-282 (listing half goes, restore half stays). No E2E spec references drafts.

### 4. Worker page and the two-table problem

- `src/app/(frontend)/pracownicy/[id]/page.tsx` — `parsePagination(sp)` :46 (→ `DEFAULT_LIMIT = 100`,
  `src/lib/utils/pagination.ts:15`); `fetchWorkerExpenseDrafts(userId)` :69;
  `<WorkerExpenseDraftsSection>` :126-133; transfers section `CollapsibleSection storageKey
"worker:transfers"`, `defaultOpen={false}` :134-139; transfers `baseUrl` is only a path prefix.
- URL keys the transfers stack reads/writes: `page`, `limit`, `sort`, `type`, `sourceRegister`,
  `investment`, `createdBy`, `worker`, `paymentMethod`, `otherCategory`, `expenseCategory`, `amount`,
  `id`, `from`, `to`, `showCancelled`, `cancelledTransactionAudit` (`src/lib/queries/transfer-filters.ts`,
  `src/components/transfers/transfer-filters.tsx:36-53` clear list, `date-filters.tsx:14-21`,
  `transfer-data-table.tsx:59,92`).
- Collisions for a second paged/filtered/sorted table: `page` (paging one pages both; any filter
  write in either resets both — `src/hooks/use-url-filter-params.ts:18-23`), `limit` (one size for
  both), `sort` (drafts sort rejected by the transfers whitelist → silent `-id`), `investment`,
  `from`/`to` (filter both; transfers „Wyczyść filtry” clears the drafts value). `status` is free.
- Column prefs are per `storageKey` (`src/lib/table/column-prefs-storage.ts:4-6`) — a distinct key
  avoids collision; two `DataTable` instances on one page are otherwise fine (all state local).
- Collapsed sections still render/fetch server-side (`collapsible-section.tsx:42-50`, localStorage).

## Code References

- `src/lib/utils/pagination.ts:15-35` — `DEFAULT_LIMIT`, `ALLOWED_LIMITS`, `parsePagination(sp, defaultLimit)`
- `src/components/ui/pagination-footer.tsx:11,19-54` — „Pokaż” select over `ALLOWED_LIMITS`, writes `{limit, page:''}`
- `src/components/ui/url-pagination.tsx:40-43` — writes `page`
- `src/hooks/use-url-filter-params.ts:13-31` — every write resets `page`
- `src/lib/db/worker-reports.ts:286-393` — list/where/order/facets/badge count to mirror
- `src/lib/db/worker-expense-drafts.ts:14-48,134-189` — row shape, select, current lists
- `src/lib/queries/transfer-filters.ts:152-155` — `?id=<n>` narrows the transfers list to one row (works on `/` and, scoped, on `/pracownicy/[id]`)
- `src/lib/constants/sections.ts:23-67` — `PAGE_TITLES`, `NAV_LINKS`
- `src/lib/queries/unread-counts.ts:15-37`, `src/components/nav/unread-badge.tsx:16` — badge plumbing

## Architecture Insights

- **One list mechanism per listing kind:** raw SQL list + count + facets in `src/lib/db`, a
  management-checked uncached fetcher in `src/lib/queries`, `DataTable` + `PaginationFooter` + a
  filters component on the client. The new page is a variant of this exact path — no new mechanics.
- **Queue order vs explicit sort:** default `pending first, newest first`; an explicit sort replaces
  it (not layered). The `status` sort is semantic via `array_position`.
- **Uncached by convention** for both report and draft reads; freshness = `router.refresh()` after an
  action. The nav badge is recomputed by the layout on refresh — no tags to add.
- **URL state is global per page.** The whole filter/pagination toolkit assumes one list per page;
  the worker page is the first that needs two.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-worker-expenses/change.md:44-50` — „Strona managera to lista Transakcji,
  bez osobnej podstrony” — the decision this change reverses (owner, 2026-10-06).
- `context/archive/2026-10-05-worker-expenses/review-gate.md:19-20` — rejected drafts scoped under
  transfer filters; sort never reaches them (page-1 block) — moot once removed. :32 — second
  `TransferRowT` mapper (`rejected-draft-row.ts`) becomes dead. :39-40 — restore refuses trashed
  parties, list hides them. :26 — multi-line accept links only the first transfer.
- `context/changes/2026-10-06-worker-expense-ai-prefill/plan.md:63` — owner wants no AI-status
  indicator in the manager's list; keep that on the new page.
- `context/archive/2026-09-30-worker-work-reports/change.md:211-213,252,274-280` — separate page +
  nav count as a pending queue; paginated/filtered like other listings; uncached reads; `${href}/`
  badge boundary. EX-955 (commit `55702979`) added paging/filters/sort to `/zgloszenia-prac`; its
  manual checks `context/foundation/manual-checks.md:3642-3663` are the checklist to mirror.
- `context/archive/2026-10-05-worker-account/change.md:59-67,111-112` — worker scope combined with
  URL filters by `and`; `AGENTS.md` phone exception for the EMPLOYEE's own `/pracownicy/[id]` (390px;
  tables scroll in their container — `manual-checks.md:3743-3745`).
- `context/archive/2026-10-05-worker-page-language/change.md:21-27` — whole worker page translated;
  the new table needs pl/uk/ru strings.
- `context/foundation/manual-checks.md` § EX-971 (:3815) — invalidated: :3839, :3841, :3843, :3851,
  :3861, :3865 (filter half), :3867; to re-point: :3817, :3825, :3827, :3853-3857, :4134-4138.
- `context/foundation/test-plan.md:73,100` — risk 22 (worker sees beyond his scope) covers the
  worker-page table. No risk row for draft history.

## Related Research

- `context/changes/2026-10-06-worker-expense-ai-prefill/research.md`

## Open Questions

1. **Worker-page drafts table — how much URL state?** (a) namespace every drafts param
   (`draftsPage`, `draftsLimit`, `draftsSort`, `draftsStatus`, …) — requires a key option on
   `parsePagination`, `PaginationFooter`/`UrlPagination`, the page-reset key in `useUrlFilterParams`,
   `DateFilters` and the sort consumer; or (b) on the worker page the table gets **pagination only**
   (one namespaced `draftsPage`, fixed 10, no filters / sort / „Pokaż”), with full filters only on the
   manager page. (b) is far smaller and fits 10 rows on a phone; it needs only a page-key option.
2. **Page size 10:** add 10 to `ALLOWED_LIMITS` (every „Pokaż” select gains it) vs. a fixed size with
   no „Pokaż” select on the worker-page drafts table. Ties to Q1.
3. **„Wydatek” column target for an accepted draft:** amount only, or a link to the transfer —
   no single-transfer page exists; `/?id=<transferId>` narrows the manager Transakcje list to that row
   (`transfer-filters.ts:152-155`). On the worker page the transfers section is collapsed by default.
   Multi-line accepts link only the first transfer.
4. **Who may see the „Decyzja” column (who decided) on the worker page** — manager-only or the
   worker too.
5. **Investment shown when trashed:** the manager history should still list accepted drafts of a
   trashed/locked investment? `/zgloszenia-prac` hides non-decidable investments entirely
   (`DECIDABLE_INVESTMENT`); for a history view of money already booked that may hide real rows.
