# Zgłoszenia wykonanych prac na stronie pracownika, z podglądem — Implementation Plan

## Overview

Show each worker's zgłoszenia wykonanych prac on `/pracownicy/[id]`, the same way his zgłoszone
wydatki are shown. Add a read-only „Podgląd” of one zgłoszenie, opened in place. Per line it shows
what was reported and what was accepted. The worker and management both get it. On
`/zgloszenia-prac`, the row-click jump into the kosztorys becomes two deliberate actions:
„Podgląd” and „Otwórz w kosztorysie”. Everything the worker reads speaks his account language.

## Current State Analysis

- No read lists one worker's reports across investments: `listWorkerReports` is investment-scoped
  (`src/lib/db/worker-reports.ts:217`). No read returns one report scoped to its worker either:
  `readWorkerReport` (`:236`) is investment-scoped and reachable only through `managementDb()`.
  Report reads are uncached by design.
- `/zgloszenia-prac` (`worker-reports-data-table.tsx:54`) makes the whole row a link to
  `reportHref(investmentId, id)`. The page description says so (`zgloszenia-prac/page.tsx:25-27`).
- Columns are a static Polish array: `WORKER_REPORT_COLUMNS` (`src/components/tables/worker-reports.tsx:10`).
  `ReportListRowT` (`worker-reports.ts:73`) lacks `source` / `decidedAt` / `decidedByName`, though
  `listDecidableReports` already selects them through `REPORT_COLUMNS` and drops them in the
  mapping (`:330-341`).
- The status labels are Polish literals: `REPORT_STATUS_LABELS` (`report-status.ts:8`) and the
  badge's „N z M” (`worker-report-status-badge.tsx:23`). Their only consumers are the badge and the
  /zgloszenia-prac status options. No sheet, e-mail or Payload consumer exists.
- The editor's review table (`review-lines-table.tsx`) is the owner-approved look. Its columns read
  `ReviewTableContext`, and its rows are built from the editor document
  (`worker-report-review.tsx:83-170`). It has four context-free columns (`ref`, `section`,
  `workerDescription`, `reported`). All its headers are Polish literals.
- The template for the worker-page table is `worker-expense-drafts-table.tsx`: paging and filters
  in client state, because the Transakcje table on the same page owns the URL.
- `DataTable` has `getRowHref` and no generic row-click handler, so rows on /zgloszenia-prac
  become inert and only the buttons act.

## Desired End State

- `/pracownicy/[id]` has a „Zgłoszenia wykonanych prac” section after „Zgłoszone wydatki”.
  - It lists every report of that worker, link or scan, on any investment (zakończona and trashed
    included).
  - Columns: Inwestycja, Wysłano, Źródło, Prace, Status, Decyzja, Akcje.
  - Filters: „Status” and „Inwestycja”; „Pokaż” sets the page size. All of it lives in component
    state, and the URL does not change.
  - The worker gets „Podgląd”. Management gets „Podgląd” + „Otwórz w kosztorysie”.
- „Podgląd” opens a dialog in place (a full-height sheet below 768 px).
  - The dialog shows the investment, sent date, status, source, decision, and the photos of a scan.
  - Two groups follow, „Z rozpiski” and „Spoza rozpiski”, with columns: Nr, Sekcja, Opis prac,
    Zgłoszono, Przyjęto.
  - „Przyjęto” is the accepted qty, „czeka” on a pending report, or „odrzucona”.
  - The worker reads descriptions, sections and units in his language. Management reads the Polish
    opis plus „Opis w języku pracownika”.
- `/zgloszenia-prac`: same column set plus „Pracownik”. The row is not a link; „Podgląd” and
  „Otwórz w kosztorysie” are the actions.
- An EMPLOYEE asking the server for another worker's report (or its photos) gets nothing — the
  read authorises on the report's stored `worker_id`.

Verify: the DB spec for the two reads, the unit spec for the preview builder, and the DOM spec for
the worker table pass. The manual checks below run at 390 px on staging.

### Key Discoveries:

- `acceptedQty` is never 0 (`worker-report/schemas.ts:12, :46, :54`), so `NULL` means not taken.
  On a pending report that reads „czeka”; on a decided one, „odrzucona”. A `rejected` report has
  zero accepted lines.
- A line's live pozycja is `COALESCE(l.created_item_id, l.item_id)`, the same key as
  `accept-worker-report.ts:195`. A deleted pozycja falls back to the line's snapshot
  (`section_name`, `description`).
- The worker-side description rule already exists as `workerDescriptionOf`
  (`worker-report-review.tsx:124-141`). A line with `polishDescription` is an extra in the worker's
  own words; otherwise the text is the pozycja's `description_translations[workerLanguage]`.
- Fetch-on-click with `loadingId` plus a rendered `dialogs` node: `useExpenseDraftAcceptance`
  (`use-expense-draft-acceptance.tsx`). Use the same shape and no effect.
- A client-invoked read is `'use server'` in `src/lib/queries` (AGENTS.md). `register-balance.ts`
  is the shape. The name `read-worker-report` is taken by the scan AI route, so the new file is
  `report-preview.ts`.
- `formatPLDateTime(date, locale)` takes a locale (`format-date.ts:18`). The expense-drafts columns
  omit it (`expense-drafts.tsx:61, 90`); the new columns pass it.

## What We're NOT Doing

- Edit / delete of a pending report by the worker (a follow-up in `change.md`).
- Any change to „Wysłane zgłoszenia” on the link page (`sent-reports.tsx`). It stays pending-only,
  link-only and non-clickable. The token path gets no preview.
- Acting on a report from the preview. Accept and reject stay in the editor („Otwórz w
  kosztorysie”).
- Translating `QueueFilters` (`filters/queue-filters.tsx`). That is the manager page, and Polish
  there is unchanged.
- Etap / przedmiar / pomiar figures, scan „uncertain” flags or prices in the preview.
- A generic row-click handler on `DataTable`.
- The missing locale in the expense-drafts date columns (`expense-drafts.tsx:65, 94`).

## Implementation Approach

Data first, then the pure view model, then UI.

1. Add two reads in `lib/db`: a list per worker, and one report with its lines joined to the live
   pozycja and sekcja.
2. Wrap them in `lib/queries`: a `server-only` page fetcher gated by `canViewWorkerPage`, and a
   `'use server'` preview read gated in SQL by the stored `worker_id`.
3. Make the preview rows in a React-free builder under `lib/kosztorys/worker-report/`. It picks the
   per-viewer description and the „Przyjęto” state, so it is unit-testable.
4. Build both tables from one column hook. Put the preview dialog and the row actions in
   `components/worker-reports/` and share them between `/zgloszenia-prac` and the worker page.

## Critical Implementation Details

- **Authorisation lives in the statement, not in the caller.** The preview read takes the viewer
  from the session and puts `AND (${isManagement} OR r.worker_id = ${viewerId})` into the report
  SELECT. The lines and media queries run only after that row came back.
  - A foreign id and a missing id return the same `null`.
  - Never accept a worker id from the client.
- **Language of the preview is decided on the server.** The query layer knows the viewer
  (`fetchUserLanguage`). It renders section names (`renderSectionName` + `getSectionTranslations`)
  and units (`translateUnit`) for the viewer before returning.
  - A manager viewer gets Polish names, plus the worker-language description column.

## Phase 1: Reads and access

### Overview

Two DB reads, their query wrappers, the widened list row, and test-plan risk #25 with its DB spec.

### Changes Required:

#### 1. List and preview reads

**File**: `src/lib/db/worker-reports.ts`

**Intent**: List one worker's reports across all investments, scans included. Read one report for
the preview, joined to its live pozycja and sekcja. Widen the list row so both lists can show
source and decision.

**Contract**:

- `ReportListRowT` gains `source: ReportSourceT`, `decidedAt: string | null` and
  `decidedByName: string | null`. Extract the mapping (`:330-341`) into one `toReportListRow(row)`
  that both list reads use.
- `listReportsByWorker(db, workerId): Promise<ReportListRowT[]>`:
  - `REPORT_COLUMNS` + `i.name`, `JOIN investments i`, `WHERE r.worker_id = $1`, ordered by
    `r.sent_at DESC, r.id DESC`.
  - No `source` filter, no `DECIDABLE_INVESTMENT`. Comment the no-trash-filter as a choice: a
    report on a zakończona or trashed investment stays in his history.
- `readReportPreview(db, reportId, viewer: { id: number; isManagement: boolean })` returns `null`
  or `{ report: WorkerReportRowT & { investmentName }, lines: ReportPreviewLineRowT[], media: MediaFileT[] }`.
  - Report SELECT with the access predicate.
  - Lines `LEFT JOIN kosztorys_items k ON k.id = COALESCE(l.created_item_id, l.item_id)`
    `LEFT JOIN kosztorys_sections s ON s.id = k.section_id`.
  - Each line adds `ref`, `itemDescription`, `descriptionTranslations` (via
    `toDescriptionTranslations`), `sectionColor` and `sectionOrder` (`s.display_order`) to the
    `WorkerReportLineRowT` fields.
  - Media query as in `readWorkerReport`.

#### 2. Query wrappers

**File**: `src/lib/queries/worker-report-history.ts` (new, `server-only`)

**Intent**: The worker-page fetcher, mirroring `fetchWorkerExpenseDrafts`.

**Contract**: `fetchWorkerReportHistory(workerId): Promise<ReportListRowT[]>`. It calls
`requireAuth(ROLES)` and then `canViewWorkerPage`, and throws otherwise. Uncached.

**File**: `src/lib/queries/report-preview.ts` (new, `'use server'`)

**Intent**: The read the preview dialog calls on click.

**Contract**: `fetchReportPreview(reportId: number): Promise<ReportPreviewT | null>`.

- Runs `requireAuth(ROLES)` and passes `{ id: user.id, isManagement: isManagementRole(user.role) }`
  to `readReportPreview`.
- Shapes the result with the Phase 2 builder for the viewer's language (`fetchUserLanguage`).
- Returns `null` when the read did.

#### 3. Test plan risk #25

**File**: `context/foundation/test-plan.md`

**Intent**: Name the new boundary before the spec. #22 covers transfers and pages, not a
client-invoked read.

**Contract**:

- New risk row **#25**: a worker opens a report that is not his (or its scan photos) through the
  preview read, by sending any report id. High impact, Medium likelihood, EX-985 lineage.
- Response row: a DB spec on the real read. A foreign and a missing id both return `null`, own
  returns lines and media, management returns any. Integration (DB-backed). Pitfall: asserting the
  dialog hides it.

#### 4. DB spec

**File**: `src/__tests__/lib/db/worker-reports.test.ts` (extend; it already provisions workers,
investments and a kosztorys tree)

**Intent**: Pin both reads on the real SQL.

**Contract**:

- `readReportPreview`:
  - Worker A reading B's report → `null`; a missing id → `null`.
  - A reading his own → lines and media.
  - `isManagement` reading B's → the report.
  - A line whose pozycja was deleted keeps its snapshot section and description.
  - An accepted extra carries the created pozycja's `ref`.
- `listReportsByWorker`: includes a scan and a report on a trashed investment, and excludes
  another worker's.
- `listDecidableReports` rows now carry `source` / `decidedAt` / `decidedByName`.

### Success Criteria:

#### Automated Verification:

- DB spec passes against the test DB: `DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/db/worker-reports.test.ts` (with `.env` exported, as `scripts/test-integration.sh` does)
- The existing scan spec stays green (link stays link-only): `pnpm exec vitest run src/__tests__/lib/actions/worker-report-scan.db.test.ts` against the test DB

#### Manual Verification:

- None for this phase alone. The read is exercised through the UI in Phases 3–4.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Preview view model and translations

### Overview

The React-free builder for the preview rows, the `workerReports` i18n namespace, and translated
status labels.

### Changes Required:

#### 1. Preview builder

**File**: `src/lib/kosztorys/worker-report/report-preview.ts` (new) + its type in the same
directory's `types.ts`

**Intent**: Turn the DB read into what the dialog renders for one viewer. All judgement lives here
and is testable without React.

**Contract**:

- `buildReportPreview(read, { viewerLanguage, isManagement, sectionTranslations }): ReportPreviewT`.
- Per line: `kind`, `ref` (`formatFormRef` applied in the UI), `scannedRef`, `sectionName`
  (rendered for the viewer), `sectionColor`, `sectionOrder`, `unit` (translated for the viewer),
  `reportedQty`, and `outcome: { kind: 'accepted'; qty } | { kind: 'pending' } | { kind: 'rejected' }`.
- Per line description:
  - `description` is what the viewer reads first: the worker's text for a worker viewer, Polish
    for management.
  - `workerDescription` is set only for management, following the `workerDescriptionOf` rule.
  - Polish = the live pozycja's description, else the snapshot. For an extra:
    `polishDescription ?? description`.
- Lines sorted by `sectionOrder`, then position.
- The header keeps status, source, sentAt, decidedAt, decidedByName, createdByName (who entered a
  scan), investmentName, lineCount, acceptedLineCount, media.
- Extract `workerDescriptionOf`'s rule into this module as a pure function and make the editor's
  `worker-report-review.tsx` call it. It is the same rule and must stay one.

#### 2. Unit spec

**File**: `src/__tests__/lib/kosztorys/worker-report/report-preview.test.ts` (new)

**Intent**: Pin the outcome and description choices.

**Contract**:

- Outcome cases: pending report → `pending`; rejected → every line `rejected`; partial accepted →
  accepted lines `accepted` with qty and the rest `rejected`.
- Description cases:
  - A worker viewer on Ukrainian reads the pozycja's uk translation.
  - The worker falls back to Polish when that translation is missing.
  - An extra shows his own words to him and the Polish to management.
- A deleted pozycja falls back to the snapshot.

#### 3. i18n namespace and status keys

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`,
`src/lib/kosztorys/worker-report/report-status.ts`

**Intent**: Every new word the worker reads exists in his language, and the status labels become
keys.

**Contract**:

- New `workerReports` namespace:
  - Section: `title` („Zgłoszenia wykonanych prac”), `hint`, `empty`.
  - Statuses: `statusPending` („Do sprawdzenia”), `statusAccepted` („Przyjęte”),
    `statusRejected` („Odrzucone”), `acceptedPartial` („Przyjęte {{accepted}} z {{total}}”).
  - List columns: `works` („Prace”), `source`, `sourceLink` („z linku”), `sourceScan` („skan”),
    `decision`.
  - Actions: `preview` („Podgląd”), `openInKosztorys` („Otwórz w kosztorysie”).
  - Dialog: `previewTitle`, `enteredBy`, `photos`, `groupRozpiska`, `groupExtra`, `notFound`.
  - Preview columns: `section`, `description`, `workerDescription`, `reported`, `accepted`,
    `linePending` („czeka”), `lineRejected` („odrzucona”).
- Words already in a namespace are read from there and not duplicated: `expenseDrafts.investment`
  / `sentAt` / `status` / `worker` / `actions`, `report.formNumber`.
- `REPORT_STATUS_LABEL_KEYS: Record<ReportStatusT, MessageKeyT<'workerReports'>>` replaces
  `REPORT_STATUS_LABELS`, mirroring `DRAFT_STATUS_LABEL_KEYS`. Delete the old map; it has no
  non-UI consumer.
- The uk / ru dictionaries currently carry another session's uncommitted hunks. Edit around them,
  and commit only by pathspec, with your own hunks alone (`git add -p` is fine; never stage theirs).

#### 4. Status badge

**File**: `src/components/worker-reports/worker-report-status-badge.tsx`

**Intent**: The badge speaks the viewer's language through `useTranslation('workerReports')`.
Callers without a provider (the editor list) still get Polish by fallback.

**Contract**: Props unchanged. Texts come from `REPORT_STATUS_LABEL_KEYS` + `acceptedPartial`.

### Success Criteria:

#### Automated Verification:

- Builder spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-report/report-preview.test.ts`
- Dictionary parity holds: `pnpm exec vitest run src/__tests__/lib/i18n/translations.test.ts`
- Editor review table unaffected by the extracted rule: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.test.tsx`

#### Manual Verification:

- None for this phase alone.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Preview dialog and the /zgloszenia-prac actions

### Overview

One column hook for both lists, the preview dialog, and the shared row actions. `/zgloszenia-prac`
switches to them and drops the row link.

### Changes Required:

#### 1. Column hook

**File**: `src/components/tables/worker-reports.tsx`

**Intent**: Replace the static `WORKER_REPORT_COLUMNS` with a translated hook shaped like
`useExpenseDraftColumns`.

**Contract**:

- `useWorkerReportColumns({ isManagerView, actions? })`.
- „Pracownik” appears only when `isManagerView`.
- Columns: Inwestycja, Wysłano (`formatPLDateTime(…, locale)`), Źródło, Prace, Status (badge),
  Decyzja (`[date, decidedByName].filter(Boolean).join(' · ')` or „—”), then an `actions` display
  column when `actions` is given.
- Server-sortable only in the manager view, using `isServerSortableReportColumn` as today. The new
  columns are not sortable.

#### 2. Preview dialog and row actions

**Files**: `src/components/worker-reports/use-report-preview.tsx`,
`report-preview-dialog.tsx`, `report-preview-table.tsx`, `worker-report-row-actions.tsx` (new)

**Intent**: Open the preview in place from any list.

**Contract**:

- `useReportPreview()` returns `{ open(reportId), loadingId, dialog }`.
  - `open` awaits `fetchReportPreview` in the click handler (no effect) and shows the dialog.
  - A `null` result shows `notFound` as a toast; a thrown error shows the generic error toast.
- `ReportPreviewDialog` uses `DialogContent` with `sm:max-w-dialog-2xl` and an inner
  `max-h-dialog-scroll overflow-y-auto`.
  - Header: investment, sent date, status badge, „skan · Wprowadził: X” for a scan, and Decyzja.
  - Scan photos: `MediaPreviewButton` with `ASSET_PREVIEW_LABELS`, as the editor review does.
  - One `ReportPreviewTable` per non-empty group, with the same group headings as
    `worker-report-review.tsx`'s `GROUPS`, translated.
  - Wrapped in `.worker-report` so the section rails apply.
- `ReportPreviewTable`: a `DataTable` with columns Nr (`formatFormRef(ref)`, else `scannedRef`,
  else empty), Sekcja (the `SectionPill` look and the `sectionColorRail` row class), Opis prac,
  „Opis w języku pracownika” (only when any line has one, i.e. management), Zgłoszono
  (`formatQtyWithUnit`), Przyjęto (qty, or „czeka” / „odrzucona” muted).
  - Promote `SectionPill` out of `review-lines-table.tsx` into
    `components/worker-reports/section-pill.tsx` and have both tables import it. A second directory
    now uses it.
- `WorkerReportRowActions({ report, canOpenInKosztorys, onPreview, isLoading })`:
  - „Podgląd” is a `RowActionButton` (Eye icon) disabled while any preview loads.
  - „Otwórz w kosztorysie” is a `Button asChild` + `Link` to `reportHref(investmentId, id)`, only
    when `canOpenInKosztorys`.

#### 3. /zgloszenia-prac

**Files**: `src/components/worker-reports/worker-reports-data-table.tsx`,
`src/app/(frontend)/zgloszenia-prac/page.tsx`

**Intent**: Deliberate entry into the editor.

**Contract**:

- Drop `getRowHref`. Use `useWorkerReportColumns({ isManagerView: true, actions })` with both
  actions, and render the hook's `dialog`.
- Status options take `t(REPORT_STATUS_LABEL_KEYS[status])`.
- Rewrite the description's last sentence: „Podgląd” shows the zgłoszenie in place, and „Otwórz w
  kosztorysie” opens the investment's rozpiska with it.

#### 4. DOM spec

**File**: `src/__tests__/components/worker-reports/report-preview-table.test.tsx` (new)

**Intent**: The rendered „Przyjęto” states and the management-only column. This is a rendered
difference a node spec cannot see.

**Contract**:

- A built preview with a pending, an accepted and a rejected line renders „czeka”, the qty and
  „odrzucona”.
- The worker-language column is absent for a worker viewer.

### Success Criteria:

#### Automated Verification:

- Preview table spec passes: `pnpm exec vitest run src/__tests__/components/worker-reports/report-preview-table.test.tsx`
- Review table still renders with the promoted `SectionPill`: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.test.tsx`

#### Manual Verification:

- `/zgloszenia-prac`: a click on a row does nothing. „Podgląd” opens the dialog over the list, and
  the address does not change. „Otwórz w kosztorysie” opens the rozpiska with that zgłoszenie (the
  address carries `?zgloszenie=`).
- The list shows „Źródło” („z linku” / „skan”) and „Decyzja” (date · kto) on decided rows, „—” on
  pending ones.
- Podgląd of a partially accepted zgłoszenie:
  - Accepted lines show their qty, the rest „odrzucona”.
  - An accepted praca spoza rozpiski shows the Nr of the pozycja it became.
  - A pending zgłoszenie shows „czeka” on every line.
- Podgląd of a skan shows „Wprowadził: …” and opens its photos.
- As a manager, „Opis w języku pracownika” sits next to the Polish opis for a worker on Українська.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Worker-page section

### Overview

The section and the client-state table on `/pracownicy/[id]`, plus the registry entries this
change reverses.

### Changes Required:

#### 1. Section and table

**Files**: `src/components/worker-reports/worker-reports-section.tsx`,
`worker-report-history-table.tsx` (new); `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: His history, shaped like `WorkerExpenseDraftsSection` / `WorkerExpenseDraftsTable`.

**Contract**:

- `WorkerReportsSection({ reports, canOpenInKosztorys, locale })` is a `CollapsibleSection` with
  `storageKey="worker:workReports"`, `withSeparator={false}`, and `title` / `hint` / `empty` from
  `workerReports`.
- `WorkerReportHistoryTable` copies the drafts table:
  - Page / size state, `DEFAULT_PAGE_SIZE = 10`.
  - Chained `useClientMultiFilter` for status, then investment.
  - Investment options built from the rows; page clamp; `PaginationBar` + `PageNav` with button
    `renderPage`.
  - `useWorkerReportColumns({ isManagerView: false, actions })` with `WorkerReportRowActions`, and
    the preview `dialog`.
  - No newest-row jump: he does not send from this page.
- Page: fetch `fetchWorkerReportHistory(userId)` inside the existing `Promise.all`. Render the
  section after `WorkerExpenseDraftsSection` with `canOpenInKosztorys={isManager}`.

#### 2. DOM spec

**File**: `src/__tests__/components/worker-reports/worker-report-history-table.test.tsx` (new;
template `worker-expense-drafts-table.test.tsx`)

**Intent**: The client-state contract holds.

**Contract**:

- Paging 10 / 10 / 5 changes no URL, and a status filter narrows and resets to page 1.
- The worker view shows „Podgląd” without „Otwórz w kosztorysie”; management shows both.

#### 3. Manual-checks registry

**File**: `context/foundation/manual-checks.md`

**Intent**: The entries at `:2917` and `:2929` assert „klik w wiersz otwiera rozpiskę”, which this
change reverses.

**Contract**: Mark both as superseded by this change, pointing at the new entries. Don't rewrite
their staging notes. `/10x-implement` adds the new entries from the bullets below.

### Success Criteria:

#### Automated Verification:

- History table spec passes: `pnpm exec vitest run src/__tests__/components/worker-reports/worker-report-history-table.test.tsx`
- Template table still green: `pnpm exec vitest run src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`

#### Manual Verification:

- As EMPLOYEE on his own `/pracownicy/[id]` at 390 px:
  - „Zgłoszenia wykonanych prac” lists his zgłoszenia, link and skan alike.
  - Paging and the filters leave the address alone.
  - „Podgląd” opens a full-height sheet that scrolls sideways inside the table, with no page-wide
    horizontal scroll.
- The same worker with Українська in his account sees the section, columns, statuses, source,
  sections and opisy in Ukrainian. A pozycja without a uk translation shows Polish.
- As a manager on that worker's page, each row has „Podgląd” + „Otwórz w kosztorysie”, and the
  opis shows Polish plus „Opis w języku pracownika”.
- A zgłoszenie on a zakończona inwestycja is listed and opens in Podgląd.
- „Wysłane zgłoszenia” on the worker's link page is unchanged: pending only, no skan, not
  clickable.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `buildReportPreview`: the „Przyjęto” outcomes, the per-viewer description, the snapshot
  fallback, and section and unit language.

### Integration Tests:

- `readReportPreview` access (risk #25): foreign / missing → `null`, own, and management.
- `listReportsByWorker` scope: scans and trashed investments in, other workers out.

### DOM Tests:

- Preview table states and the management-only column.
- History table paging and filters in state, and the actions by audience.

### Manual Testing Steps:

The bullets in Phases 3–4, on staging (`context/reference/manual-verification.md`).

## Performance Considerations

- Each list is one statement per page load, and a worker has tens of reports. The preview is one
  report SELECT plus two small parallel queries, on click.
- `getSectionTranslations` is already cached and arg-free.

## Migration Notes

None. No schema change.

## Whole-tree Gate

Run once, after Phase 4:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- DB-backed specs pass: `pnpm test:integration`
- Full unit + DOM suite passes: `pnpm test`, at the review gate, when asked

## References

- Research: `context/changes/2026-10-06-worker-reports-on-worker-page/research.md`
- Decisions: `context/changes/2026-10-06-worker-reports-on-worker-page/change.md`
- Table template: `src/components/worker-expenses/worker-expense-drafts-table.tsx`
- Fetch-on-click template: `src/components/worker-expenses/use-expense-draft-acceptance.tsx`
- Review table look: `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:405-596`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reads and access

#### Automated

- [x] 1.1 DB spec passes against the test DB — 25d7da8d
- [x] 1.2 The existing scan spec stays green — 25d7da8d

### Phase 2: Preview view model and translations

#### Automated

- [x] 2.1 Builder spec passes
- [x] 2.2 Dictionary parity holds
- [x] 2.3 Editor review table unaffected by the extracted rule

### Phase 3: Preview dialog and the /zgloszenia-prac actions

#### Automated

- [ ] 3.1 Preview table spec passes
- [ ] 3.2 Review table still renders with the promoted `SectionPill`

### Phase 4: Worker-page section

#### Automated

- [ ] 4.1 History table spec passes
- [ ] 4.2 Template table still green
