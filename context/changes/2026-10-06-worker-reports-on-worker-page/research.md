---
date: 2026-10-06T17:23:27+02:00
researcher: Claude (Opus 5.5)
git_commit: 5fabf1be5378b7be2a195997650f0af3cd27f850
branch: staging
repository: wykonczymy
topic: 'Zgłoszenia wykonanych prac na stronie pracownika + podgląd zgłoszenia + akcje na /zgloszenia-prac'
tags: [research, codebase, worker-reports, worker-page, data-table, i18n, access]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
---

# Research: Zgłoszenia wykonanych prac na stronie pracownika, z podglądem zgłoszenia

**Date**: 2026-10-06T17:23:27+02:00
**Git Commit**: 5fabf1be (staging) — **working tree dirty**: the in-flight change
`worker-expense-drafts-history` has uncommitted edits in several files this change touches (see
§Collision). Line numbers in (M) files are a snapshot and may move.

## Research Question

After the decisions in `change.md`: what exists, what is missing, and what constrains (a) a
worker-reports table on `/pracownicy/[id]`, (b) a read-only „Podgląd” of one report opened in place,
(c) `/zgloszenia-prac` replacing row-click navigation with „Podgląd” / „Otwórz w kosztorysie”, (d)
translating all of it into the viewer's account language.

## Summary

- **Two new server reads are needed; nothing else in the data layer.** No query lists one worker's
  reports across investments, and no read returns one report scoped to its worker (today's
  `readWorkerReport` is investment-scoped and reachable only through `managementDb()`). Report reads
  are uncached by design, so no cache tags.
- **The preview is a new small column set on the `DataTable` engine, not a mode of
  `ReviewLinesTable`.** Four of the review table's columns are context-free (`ref`, `section`,
  `workerDescription`, `reported`); the rest read `ReviewTableContext` drafts, and the row data
  (`ReviewRowT`) is built from the editor document. The preview's rows come from a new SQL read that
  joins each line to its live pozycja / sekcja.
- **Per-line „przyjęto” is fully derivable:** `acceptedQty` is never 0 (schema requires > 0), so
  NULL = not taken → „czeka” on a pending report, „odrzucona” on a decided one. A `rejected` report
  always has zero accepted lines; partial acceptance only shows as `accepted` with
  `acceptedLineCount < lineCount`.
- **The table is a straight copy of the expense-drafts worker table** (client-state paging +
  `useClientMultiFilter`, column hook with `isManagerView` / `actions`, „Decyzja” = „kiedy · kto”).
- **i18n: everything worker-report-side is hard-coded Polish today**; status labels have no
  non-UI consumer, so they become a key map like `DRAFT_STATUS_LABEL_KEYS`. Needs a new namespace.
- **Removing the row link breaks no test**; it reverses an owner decision (EX-947 #15) and two
  manual-check entries, which the new decision supersedes.
- **New test-plan risk needed (#25):** an EMPLOYEE reading another worker's report via the preview
  read.

## Detailed Findings

### 1. List read — one worker, all investments

- `listWorkerReports(db, investmentId, workerId?, {linkOnly, pendingOnly})`
  (`src/lib/db/worker-reports.ts:217-233`, M) — scoped to one investment, no investment name.
  Returns `WorkerReportRowT` (`:36-53`), which already has `status`, `source`, `sentAt`,
  `decidedAt`, `decidedByName`, `createdByName`, `lineCount`, `acceptedLineCount`.
- The manager list `listDecidableReports` (≈`:308`, M) returns the narrower `ReportListRowT`
  (`:73-82`: no `source`, `decidedAt`, `decidedByName`) and filters out zakończone / trashed
  investments (`DECIDABLE_INVESTMENT`, `:86`). Workers in the trash are not filtered
  (`REPORT_JOINS` plain `JOIN users`, `:96-100`).
- **Fit:** a new `listReportsByWorker(db, workerId)` —
  `SELECT ${REPORT_COLUMNS}, i.name … ${REPORT_JOINS} JOIN investments i … WHERE r.worker_id = $1
ORDER BY r.sent_at DESC, r.id DESC`, without `linkOnly` (scans included, per decision) and
  without `DECIDABLE_INVESTMENT` (per default „widoczne zawsze”). Fetcher in `src/lib/queries`
  re-checks `canViewWorkerPage`, like `fetchWorkerExpenseDrafts`
  (`src/lib/queries/worker-expense-drafts.ts:21-31`, M).

### 2. One report's lines — what the preview shows

- `readWorkerReport(db, investmentId, reportId)` (`worker-reports.ts:236-279`) → report, lines
  (`:253-259`), media (`:260-265`). `WorkerReportLineRowT` (`:55-71`).
- Line semantics:
  - `reportedQty` — always set.
  - `acceptedQty: number | null` — never 0 (`worker-report/schemas.ts:12, :46, :54`).
  - `description` — rozpiska line: Polish item text snapshotted at send
    (`lib/kosztorys/worker-report/report-lines.ts:25-35`); extra: the worker's own words, with
    `polishDescription` / `descriptionLanguage` filled by the post-send translation
    (`translate-report-lines.ts:28`).
  - `createdItemId` — set when an accepted extra created a pozycja.
- Status transitions: reject flips only a pending report (`claimPendingReport`, `:396`); a later
  accept sets `accepted` from any status (`markReportAccepted`, `:419`); unticking the last
  accepted line reopens to pending (`reopenReportIfNoneAccepted`, `:455`).
- **What the editor-free preview needs per line**, joined in SQL:
  `LEFT JOIN kosztorys_items k ON k.id = COALESCE(l.created_item_id, l.item_id)` (same key as
  `accept-worker-report.ts:195`) + `kosztorys_sections` → `ref`, `description_translations`,
  section `name` / `color` / `display_order` (`lib/db/kosztorys-tree.ts:63-75`). Pozycja deleted →
  fall back to the line's snapshot (`sectionName`, `description`).
- Not derivable without the editor and not needed: `figures` (etap/przedmiar/pomiar),
  `isFigureLive`, `isUnassigned`, drafts (`worker-report-review.tsx:83-170`).

### 3. Access for the preview read

- No on-demand detail read exists for any worker-facing dialog; expense-draft „Zobacz” passes the
  already-fetched row (`worker-expense-drafts-table.tsx:68`). The only report detail read,
  `readInvestmentReport` (`src/lib/queries/worker-reports.ts:27-35`, M), is management-only.
- Client-invoked read precedents: `src/lib/queries/register-balance.ts:10-24` (`'use server'`,
  `requireAuth`, throws) and `investment-asset-ids.ts:15-23` (`protectedAction`, `ActionResultT`).
- **Rule to implement:** `'use server'` read in `src/lib/queries`, `requireAuth(ROLES)`, then SQL
  `WHERE r.id = $id AND ($isManagement OR r.worker_id = $viewerId)` — authorise on the report's
  stored `worker_id`, never on a client-sent worker id; foreign and missing both return nothing.
  Session only, no token path (decision).
- **Name clash:** `src/app/(frontend)/api/read-worker-report/route.ts` is the scan AI reader — pick
  another name (e.g. `report-preview.ts`).

### 4. UI — table, actions, preview

- **Engine:** `src/components/tables/data-table/data-table.tsx:42-74`; no actions prop — an actions
  column is a `col.display({ id: 'actions' })`. Row click ignores `a, button` and portaled dialogs
  (`data-table-row.tsx:29-48`), so in-row buttons are safe.
- **/zgloszenia-prac:** drop `getRowHref` (`worker-reports-data-table.tsx:54`, M); the page
  description „Wiersz otwiera rozpiskę…” (`zgloszenia-prac/page.tsx:25-27`) must change with it.
- **Columns:** `WORKER_REPORT_COLUMNS` (`src/components/tables/worker-reports.tsx:10-26`) is a static
  array with Polish headers → becomes a hook like `useExpenseDraftColumns`
  (`src/components/tables/expense-drafts.tsx:46`, M): `isManagerView` adds „Pracownik” (`:51-53`),
  „Decyzja” cell `[formatPLDateTime(decidedAt), decidedByName].join(' · ')` (`:85-92`), `actions`
  slot (`:101-112`). New: source column („z linku” / „skan”).
- **Worker table:** copy `worker-expense-drafts-table.tsx` (M): `useState` page/size (`:39-47`),
  chained `useClientMultiFilter` (`:49-58`), investment options from rows (`:77-81`), clamp
  (`:83-85`), `PaginationBar` + `PageNav` with button `renderPage` (`:119-134`). „Pokaż” is
  `PaginationBar`'s size select, not a filter.
- **Action buttons:** closest „dialog button + link button” pattern:
  `src/components/sheets/linked-sheet-actions.tsx:50-88` (`Button asChild` + `Link`, and
  `RowActionButton` from `ui/row-actions/row-action-button.tsx`). Dialog per row vs one dialog at
  table level (expense-drafts „Zobacz”, `expense-drafts-data-table.tsx:45-57, :80`) — plan picks.
- **Preview columns:** context-free in `review-lines-table.tsx`: `refColumn` (`:460-467`),
  `sectionColumn` (`:469-473`, `SectionPill` `:405-411`), `workerDescriptionColumn` (`:481-485`),
  `reportedColumn` (`:486-493`). Context-bound: description cells (`RozpiskaDescriptionCell :163`,
  `ManualDescriptionCell :341`), `ScanFlags :144`, `getRowClassName :586-591`, everything else.
  Groups rozpiska / extra: `COLUMNS_BY_GROUP :546-569`, headings `GROUPS`
  (`worker-report-review.tsx:62-69`); in read-only, group by `line.kind`. Section rails need the
  `.worker-report` wrapper (`globals.css:530-560`).
  **But** all headers there are Polish literals (`:460-544`) → the preview needs its own column hook
  taking `t`; reuse the cell components / helpers (`formatFormRef`, `SectionPill`,
  `reviewedDescription`), not the column constants.
- **Dialog on phone:** `ui/dialog.tsx:58-63` — below `sm` (768 px) every `DialogContent` is a
  full-height sheet. Editor's report dialog uses `sm:max-w-dialog-2xl` (`worker-reports-dialog.tsx:21`);
  inner scroll `max-h-dialog-scroll overflow-y-auto` (`worker-report-review.tsx:342`). Tables scroll
  horizontally (`data-table.tsx:203`); the review table is already wider than 390 px
  (`DESCRIPTION_MIN_WIDTH = 'min-w-96'`, `:452`) — the owner-approved layout.
- **Worker page:** new section after `WorkerExpenseDraftsSection` (`pracownicy/[id]/page.tsx:126-133`),
  fetch into the `Promise.all` (`:61-70`); shell like `worker-expense-drafts-section.tsx`
  (`CollapsibleSection`, `storageKey="worker:…"`).

### 5. i18n

- Mechanics: `src/lib/i18n/translations.ts` (`TranslationsT = typeof pl`, `createTranslator :82`,
  `tp` plurals), `useTranslation` (`src/hooks/use-translation.ts:21`), provider mounted in
  `(frontend)/layout.tsx:65-68` with the viewer's language. New namespace = object in `pl.ts`, same
  keys in `uk.ts` / `ru.ts`; parity enforced by `tsc` and `src/__tests__/lib/i18n/translations.test.ts:73-79`.
- Template: `DRAFT_STATUS_LABEL_KEYS` (`src/lib/constants/worker-expense-drafts.ts:11-15`, M) +
  `DraftStatusBadge`. Mirror: `REPORT_STATUS_LABEL_KEYS` beside `REPORT_STATUSES`
  (`lib/kosztorys/worker-report/report-status.ts:1-12`).
- Hard-coded Polish today: `tables/worker-reports.tsx:10-26`, `worker-report-status-badge.tsx:10-25`
  (incl. literal „N z M”, `:23`), `worker-reports-data-table.tsx:21-24`,
  `filters/queue-filters.tsx:38-63` (M; `transfers.filter*` keys already exist).
- Status labels have **no non-UI consumer** (no sheet sync, email, Payload graph) — free to swap for
  keys; the badge's other consumer is the editor list (`worker-reports-list.tsx:77`, Polish default).
- Don't reuse `expenseDrafts` status keys — gender/number differ („przyjęty” vs „Przyjęte”).
  Reusable: `expenseDrafts.investment/sentAt/status/actions`, `report.items` plural,
  `report.formNumber` („Nr”), `filters.*`.
- New keys: 3 statuses, „przyjęte {{n}} z {{total}}”, „Prace”, „z linku” / „skan”, „Podgląd”,
  „Otwórz w kosztorysie”, preview headers (Sekcja, Opis prac, Zgłoszono, Przyjęto), „czeka”,
  „odrzucona”, dialog title.
- Worker-language texts: section names `renderSectionName(...)` +
  `getSectionTranslations()` (`lib/i18n/section-translations.ts:27,53`,
  `lib/queries/section-translations.ts:11`, cached, arg-free); descriptions
  `translationText(item.descriptionTranslations, locale)` (`lib/i18n/description-translations.ts:36`);
  units `translateUnit` (`lib/kosztorys/worker-view/translate-unit.ts:20`). The manager's pair:
  `workerDescriptionOf` (`worker-report-review.tsx:124-141`) + `reviewedDescription`.
- Formatting: `formatPLDateTime(date, locale)` takes a locale (`lib/utils/format-date.ts:18`) —
  expense-drafts columns call it **without** one (`expense-drafts.tsx:61,90`), a gap not to copy.
  `formatQty` is pl-PL only; translate the unit before `formatQtyWithUnit`.

## Code References

- `src/lib/db/worker-reports.ts:36-100, 217-279, 308, 396-455` — row types, list/read, transitions (M)
- `src/lib/queries/worker-reports.ts:22-35` — management-only `'use server'` report reads (M)
- `src/lib/queries/worker-expense-drafts.ts:21-31` — worker-page fetcher with `canViewWorkerPage` (M)
- `src/lib/auth/roles.ts:32-33` — `canViewWorkerPage`
- `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:38-63, 405-596` — review row type, columns
- `src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:62-170, 273, 342` — row building, groups, layout
- `src/components/tables/worker-reports.tsx:10-26` — today's static columns
- `src/components/tables/expense-drafts.tsx:46-112` — column-hook template (M)
- `src/components/worker-expenses/worker-expense-drafts-table.tsx` — client-state table template (M)
- `src/components/worker-reports/worker-reports-data-table.tsx:21-24, 54` — status options, row href (M)
- `src/components/sheets/linked-sheet-actions.tsx:50-88` — link + dialog action buttons
- `src/app/(frontend)/pracownicy/[id]/page.tsx:61-70, 126-133` — fetch + section slot
- `src/app/(frontend)/zgloszenia-prac/page.tsx:25-27` — description to rewrite

## Architecture Insights

- Authorise on the stored row (`worker_id`), not on a caller-supplied id — the same spirit as
  lesson `:577` (a caller-supplied `Where` can never be relaxed for a public surface) and `:207`
  (follow the value to its read path).
- Lesson `:478` (price-view flag ≠ audience flag): the manager/worker difference in the preview
  (Polish + worker text vs worker text; „Otwórz w kosztorysie”) is gated on **who is looking**, and
  the preview carries no price at all (consistent with EX-947 #10, „no rates”).
- Lesson `:2512`-ish (every raw reader carries its own `trashed_at` filter): the new list read is a
  new reader — „visible always” is the decision, so this is a conscious no-filter, to state in code.
- Lesson `:1979`: a click during dialog teardown is dropped — relevant if the preview dialog opens
  from a row button while another dialog closes.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-worker-work-reports/change.md:211-213` — EX-947 #15: list entry opens
  the rozpiska with the report open (introduced `e0244f47`, `9e18b649`; `reportHref` from `1b431de0`).
  **Superseded** by this change's decision.
- same file `:221-223` (#19) — „the worker sees each report's status: czeka / przyjęte / odrzucone”;
  `:38` (#3) — the report keeps reported and accepted figure. No decision hides accepted qty from
  the worker.
- `292eaa14` (2026-10-06) — the link's list shows pending only, no per-row status; no change folder,
  only `manual-checks.md:3978`. This change gives statuses back on the worker page.
- `context/archive/2026-10-05-worker-report-scan/change.md:77-80` — EX-949 #9: a scan stays off the
  worker's link (`linkOnly`, comment `worker-reports.ts:221`). This change shows scans on
  `/pracownicy/[id]` deliberately; the link stays link-only.
- `context/changes/2026-10-06-worker-expense-drafts-history/` — client-state table on the worker
  page (`research.md:160-178`), `ALLOWED_LIMITS` incl. 10, „Decyzja” in both views, the worker can't
  open transactions.

## Tests and checks this change touches

- No spec asserts the `/zgloszenia-prac` row href (`e2e/drivers/expenses.ts:106` uses `getRowHref`
  on `/inwestycje` only).
- Must stay green: `review-lines-table.test.tsx` (if shared cells move),
  `worker-report-scan.db.test.ts:152` (link stays link-only), `roles.test.ts:62-69`,
  `worker-reports.test.ts:132` (investment-scoped read).
- Templates: `worker-expense-drafts-table.test.tsx` (paging 10/10/5, no URL change),
  `worker-investments-section.test.tsx`.
- `context/foundation/test-plan.md`: anchor on **#22** (`:73`, worker beyond his scope; `:100` „the
  page and every server action are reachable by URL”). **New risk #25**: EMPLOYEE reads a foreign
  report (or its photos) through the preview read — DB-backed spec: foreign id returns nothing.
- `context/foundation/manual-checks.md:2920, 2929-2931` (row click opens rozpiska) — reversed;
  `:4191` (EX-1005) — template for 390 px / no-URL / UA checks.

## Collision with the in-flight change

Uncommitted (M) in files this change edits: `worker-reports-data-table.tsx`,
`lib/db/worker-reports.ts` (now `queueFiltersWhere`), `lib/queries/worker-reports-list.ts`,
`lib/queries/worker-reports.ts` (`management-db.ts`), `filters/queue-filters.tsx`,
`ui/pagination/*`, `pl/uk/ru.ts`, `worker-report/report-grid.tsx`,
`users/worker-investments-section.tsx`. Plan after that change commits (decision in `change.md`).

## Open Questions

1. ~~**Scan photos in the worker's preview.**~~ **Resolved (owner, 2026-10-06): he sees them** —
   recorded in `change.md`.
2. **Pending report in the manager's preview** — „Podgląd” is read-only for management too; acting
   on it stays „Otwórz w kosztorysie”. Assumed, consistent with change.md.
3. **Dates in uk/ru** — pass `locale` to `formatPLDateTime` in the new columns. Plan: new columns
   only; the expense-drafts gap stays out of scope.
