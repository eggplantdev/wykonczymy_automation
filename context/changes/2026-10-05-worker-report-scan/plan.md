# EX-949 — Paper → AI → zgłoszenie prac: Implementation Plan

## Overview

A kierownik prints a worker's fill-in form („Drukuj do wypełnienia"), the worker writes quantities
on it, and the kierownik photographs it. The AI reads each photo, and the app creates a `pending`
zgłoszenie for the chosen worker × investment, then opens it in the existing verification dialog,
with the photos beside the lines. Every decision is in `change.md` (#1–#13). This plan builds them,
reusing what exists at every step: the worker print, the receipt reader, `submitWithUploads`, and
the review dialog.

## Current State Analysis

- **Pozycja identity.** A pozycja's only identity is `kosztorys_items.id`. Restore, sheet import and
  szablon wipe and reinsert the tree, which mints new ids. `insertItems`
  (`src/lib/kosztorys/insert-rows.ts:118-139`) is the single item INSERT.
- **The worker print** (`src/lib/kosztorys/print/worker.ts:95-144`) already prints the worker's rows
  in his language. Its parts are `WorkerPrintMenuItem` → `getWorkerKosztorysPrintData` →
  `buildKosztorysPrintHtml`.
- **The receipt reader** already reads images through OpenRouter (`src/lib/ai/openrouter.ts`,
  `openrouter-client.ts`, the `extract-receipt` route).
- **The worker's send path:**
  - `sendWorkerReportAction` (`src/lib/actions/worker-report.ts`) builds lines from live pozycje,
    then `insertWorkerReport` + `after(translateReportExtras)`.
  - The review dialog (`worker-report-review.tsx`, `review-lines-table.tsx`, `line-draft.ts`) and
    `accept-worker-report.ts` decide lines. Both already handle a rozpiska line with `item_id NULL`,
    through re-point / „Przenieś do prac spoza rozpiski".
- **Missing today:**
  - a stable number;
  - a report's source and author;
  - line uncertainty;
  - photos on a report;
  - a management create path;
  - any scan UI.

## Desired End State

- **Stable number.** Every pozycja carries a stable number that survives „Przywróć wersję" and
  sheet import.
- **Fill-in form.** Pracownicy menu → worker → „Drukuj do wypełnienia" prints the worker print's
  rows, in his language. Each row shows Nr „35812-7" (number + Damm check digit), opis, j.m. and an
  empty „Wykonano" column. Blank „Prace spoza rozpiski" rows follow. No money, no etapy.
- **Scanning.**
  - Entry points: „Zgłoszenia prac" (button → worker → investment → photos) or the editor's
    Pracownicy menu (worker → photos).
  - The scan creates a `pending` zgłoszenie (`source = 'scan'`, `created_by` = the kierownik) with
    its photos, then lands in verification.
  - A valid number resolves to its pozycja. Anything else is „do przypisania".
  - The worker never sees the zgłoszenie on `/z/`.
- **Verification shows:**
  - the photos;
  - flags: „niepewny odczyt", a number read twice, no j.m.;
  - the header line „Wczytane z kartki przez …".

  Lines read twice are not ticked by „Zaznacz wszystkie". A praca spoza rozpiski with no j.m.
  accepts only once a katalog praca is assigned; the client and the server both enforce that.

### Key Discoveries:

- The DEFAULT of `insertItems` fires only when the column is omitted, never when NULL is bound
  (`snapshot-format.ts:145-147`). Write `ref ?? DEFAULT`.
- All five szablon paths serialize through `serializeKosztorysAsPreset`
  (`serialize-preset.ts:25-31`), so stripping `ref` there makes every szablon mint.
- Sheet import carries the note and the translations by `itemKey` at `build-import-plan.ts:234,237-241`.
  `ref` rides the same match.
- The import plan uses synthetic ids 1..n (`build-import-plan.ts:164,217`). **Never** fall back to
  `ref ?? id`.
- `kosztorys_items` is a Payload collection with `push: false` (`payload.config.ts:69-74`). A
  hand-written column causes no drift. Leave `ref` out of the collection config.
- The worker's scope narrows etapy, not pozycje (`worker-kosztorys.ts:83-88`). The form lists the
  same rows the worker print does.
- `sendWorkerReportAction` refuses duplicate itemIds (`worker-report.ts:35-38`) and requires a unit
  (`schemas.ts:23-24`). The scan path must not reuse those two checks, but it reuses the line build
  (:56-82).
- `submitWithUploads` discards ids on failure through `reclaimUnreferencedMedia`. The photos are
  safe only once `worker_report_media` is registered in the media reference guards.
- Acceptance sums per pozycja (`accept-worker-report.ts:274-286`), so two lines on one pozycja would
  be added together. „Zaznacz wszystkie" (`review-lines-table.tsx:84`) is where that happens by
  accident.

## What We're NOT Doing

- **Page numbering, missing-page detection, or any new print mechanics.** The form is the worker
  print with other columns.
- QR codes, or checking the header's worker/investment names.
- Scanning from `/z/`, the worker's own page, or the „Pracownicy" listing.
- Any text comparison (opis or j.m.) to resolve a number.
- A new AI model. The scan uses `RECEIPT_MODEL` + `withModelFallback` as they are.
- Showing the stable number anywhere else: the editor grid, the history diff, or `/z/` draft keys.
- Re-linking `worker_report_lines.item_id` after a restore through `ref`.
- **The Blob bytes an investment purge leaves behind.** Pre-existing; filed separately in Linear.
- Hours.

## Implementation Approach

The work runs bottom-up:

1. the number and its check digit;
2. the form that prints it;
3. the data model and the create action that resolves it;
4. the AI read that feeds the action;
5. the dialog that drives it;
6. verification.

Each layer is a parameterisation of an existing one: `insertItems` / the snapshot / the import
carry; `buildWorkerPrintHtml` / `WorkerPrintMenuItem`; `insertWorkerReport` / the
`worker_expense_draft_media` pattern; the receipt reader; `ExpenseDraftDialog`; the review dialog.

## Critical Implementation Details

- **Order inside the create action.** The client runs the AI reads _before_ uploading. A failed read
  then uploads nothing. Only once every photo has a read does it call
  `submitWithUploads(files, ids => createScannedReportAction(...))`. The action resolves numbers
  against the live tree at insert time; the route never does.
- **Prod migration order.** Both migrations are additive, so prod is migrated before the push that
  ships the code (`payload-prod-migrate`). A human runs it.

## Phase 1: Stable number + check digit

### Overview

Every pozycja gets `ref`. It is kept through restore and sheet import, and minted everywhere else.
A pure Damm module gives the check digit.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next>_add_kosztorys_item_ref.ts` + `src/migrations/index.ts`

**Intent**: add a global stable number to every pozycja, backfilled from the id.

**Contract**:

- `kosztorys_items.ref integer` and a new sequence `kosztorys_items_ref_seq`.
- Backfill `ref = id`, then `setval` the sequence to `max(ref)` computed in the migration (never a
  literal).
- Then `DEFAULT nextval(...)`, `NOT NULL`, `UNIQUE`.
- `down` drops the column and the sequence.
- Header style: `20261002_2_section_translations.ts`. Name: the next free `YYYYMMDD_N` after the
  `20261005_*` entries.

#### 2. Type, read, and insert

**Files**: `KosztorysItemT` (its type file), `src/lib/db/kosztorys-tree.ts` (query :71-77,
`mapItem` :151), `src/lib/kosztorys/insert-rows.ts`

**Intent**: carry `ref` through the tree read, and let an insert either keep a given number or draw
a new one.

**Contract**:

- `KosztorysItemT.ref: number`.
- The insert payload takes an optional `ref`. `insertItems` writes `ref ?? DEFAULT` and adds `ref`
  to `RETURNING`; the four callers that return rows to the client get it for free.

#### 3. Snapshot, preset, import

**Files**: `src/lib/kosztorys/snapshot-format.ts`, `src/lib/kosztorys/serialize-preset.ts`,
`src/lib/kosztorys/sheet-import/build-import-plan.ts`

**Intent**: restore keeps numbers; an old snapshot and every szablon path mint; an import carries the
number to the matched pozycja.

**Contract**:

- `'ref'` joins `TolerantT`, and `itemWithColumnDefaults` gives `ref: item.ref ?? undefined`.
- `serializeKosztorysAsPreset` drops `ref`.
- `build-import-plan.ts:234` gains `ref: current?.ref` beside `note`.

#### 4. Check digit

**File**: `src/lib/kosztorys/worker-report/check-digit.ts`

**Intent**: a printable, OCR-safe form of a number, and its parse.

**Contract**:

- `dammDigit(value: number): number`.
- `formatFormRef(ref: number): string` → `"35812-7"`.
- `parseFormRef(text: string): number | undefined`. It returns the number only when the format
  matches `^\d+-\d$` and the check digit is valid.

### Success Criteria:

#### Automated Verification:

- The migration applies and rolls back on the local DB: `pnpm payload migrate` / `migrate:down`
  (check `git status src/migrations` first).
- Unit spec `src/__tests__/lib/kosztorys/worker-report/check-digit.test.ts`:
  - every single-digit substitution and every adjacent transposition of a sample number is rejected;
  - a round trip of `formatFormRef` → `parseFormRef` returns the number.
- Unit specs for the snapshot tolerance (an old snapshot without `ref` restores with `ref`
  undefined) and the import plan (a matched pozycja keeps `ref`; an unmatched one has none), beside
  the existing specs.
- DB spec `src/__tests__/lib/kosztorys/item-ref.db.test.ts`:
  - restore keeps every `ref`;
  - Wczytaj szablon mints new ones;
  - `addItemAction` mints;
  - no two pozycje share a `ref`.

#### Manual Verification:

- Editor → change a pozycja → „Przywróć wersję" to an earlier version → a form printed before the
  restore still resolves the same pozycje when scanned (checked again in Phase 6).

---

## Phase 2: „Drukuj do wypełnienia"

### Overview

A second worker print beside „Drukuj PDF": same data, builder, styles and window, with other columns
and a blank-rows footer.

### Changes Required:

#### 1. Form builder

**File**: `src/lib/kosztorys/print/worker.ts`, plus a form column set beside `worker-columns.ts`

**Intent**: `buildWorkerFormHtml(args: WorkerPrintArgsT)` takes the same args, `translateTree`,
`documentRows(rows, stages, worker.settings.hideEmptyRows)` (minus empty opisy, filtered on the
untranslated tree) and `buildKosztorysPrintHtml`, with `WIDE_PRINT_STYLES`.

**Contract**:

- Columns:
  - Nr (`formatFormRef(row.ref)`, ≥ 7pt, `#52525b`);
  - opis;
  - j.m.;
  - Wykonano (empty, wide; override the odd-column stripe in `extraStyles`).
- Money: a `moneyKey` no column has, so section totals are off. `totalNet: 0`, and an empty
  `sectionNetById`.
- `footerHtml`: a „Prace spoza rozpiski" table of blank rows (opis / j.m. / ilość). Ten rows.
- `documentKind`: a new `report.formDocumentKind`.

#### 2. Dictionaries

**Files**: `src/lib/i18n/dictionaries/pl.ts`, `uk.ts`, `ru.ts`

**Intent**: the form's labels in the worker's language.

**Contract**:

- New `report.formNumber` („Nr"), `report.formExecuted` („Wykonano") and `report.formDocumentKind`
  („Do wypełnienia — {{name}}").
- Reuse `extrasTitle`, `grid.description`, `unitPlaceholder` and `qtyPlaceholder`.

#### 3. Menu item

**Files**: `src/components/kosztorys/editor/actions/worker-print-action.tsx`,
`kosztorys-workers-menu.tsx`

**Intent**: `WorkerPrintMenuItem` takes which builder to call and its label. The menu renders it
twice per worker, with the same `disabled`.

**Contract**: a `variant: 'pdf' | 'form'` prop maps to `buildWorkerPrintHtml` / `buildWorkerFormHtml`
and „Drukuj PDF" / „Drukuj do wypełnienia".

### Success Criteria:

#### Automated Verification:

- Unit spec `src/__tests__/lib/kosztorys/print/worker-form.test.ts`:
  - the HTML holds one `formatFormRef` per listed pozycja, and no PLN amount;
  - a pozycja hidden by `hideEmptyRows`, or one with an empty opis, is absent;
  - the extras table has its blank rows;
  - with `locale: 'uk'` the labels are Ukrainian.

#### Manual Verification:

- Editor → Pracownicy → a worker → „Drukuj do wypełnienia": the print window shows Nr „xxxxx-d",
  opis, j.m., an empty „Wykonano" column and blank rows. No amounts, no etapy.
- A worker set to Ukrainian: the form is in Ukrainian, with the same rows as „Drukuj PDF".
- A blocked worker: the item is disabled.

---

## Phase 3: Data model + create action

### Overview

The tables learn source, author, uncertainty and photos. A management action creates a scanned
zgłoszenie from reads, and `/z/` hides it.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next>_add_worker_report_scan.ts` + `index.ts`

**Intent**: record where a report came from, who filed it, uncertain lines, unresolved numbers, and
the photos.

**Contract**:

- `worker_reports`:
  - `source varchar NOT NULL DEFAULT 'link' CHECK (source IN ('link','scan'))`;
  - `created_by_id integer REFERENCES users ON DELETE SET NULL`.
- `worker_report_lines`:
  - `is_uncertain boolean NOT NULL DEFAULT false`;
  - `scanned_ref varchar` (null except on a scanned rozpiska line whose number did not resolve).
- `worker_report_media`, modelled on `20261005_3:32-40`:
  - `report_id` → CASCADE, `media_id` → CASCADE;
  - `position`;
  - PK `(report_id, media_id)`;
  - an index on `media_id`.

#### 2. DB layer

**File**: `src/lib/db/worker-reports.ts`

**Intent**: insert a report with source, author, line flags and media in one statement; read them
back; let `/z/` exclude scans.

**Contract**:

- `insertWorkerReport` takes optional `source`, `createdById`, per-line `isUncertain` /
  `scannedRef`, and `mediaIds`. The media go in a third CTE, all-or-nothing, as in
  `worker-expense-drafts.ts:98-114`.
- `readWorkerReport` returns `source`, `createdByName` (LEFT JOIN users), line flags, and photos
  ordered by position.
- `listWorkerReports(db, investmentId, workerId?, { linkOnly })`. Only `worker-report-page.ts:85`
  passes `linkOnly: true`.
- New `readReportTarget(db, investmentId, workerId)` returns the `ReportShareT` shape: the SELECT of
  `worker-report-share.ts:25-33` without the token.

#### 3. Media guards

**Files**: `src/lib/media/prevent-referenced-delete.ts:22`, `src/lib/media/delete-unreferenced-media.ts:107`

**Intent**: a photo held by a report is never reclaimed or deleted.

**Contract**: `countReportsHoldingMedia` and `findReportHeldMedia`, registered beside the
expense-draft probes.

#### 4. Resolve + create action

**Files**: `src/lib/kosztorys/worker-report/resolve-scan.ts` (React-free), `src/lib/actions/worker-report-scan.ts`

**Intent**: turn page reads into report lines and insert a `pending` scanned report.

**Contract**:

- Read types:
  - `ScanPageT = { rows: { ref: string, qty: number | null, isUncertain: boolean, description?: string }[], extras: { description: string, unit: string | null, qty: number | null, isUncertain: boolean }[] }`.
- `resolveScanLines(pages, tree, allowedUnits)`:
  - **Rows:**
    - `parseFormRef` plus a live `ref` in this tree → a rozpiska line (opis / j.m. / sekcja from
      the pozycja, through the line builder extracted from `worker-report.ts:56-82`);
    - otherwise → a rozpiska line with `item_id` null, `scanned_ref` set, and the AI's description
      or the raw ref as text.
  - **Extras:** unit kept only if it is in `allowedUnits`, else `''`.
  - **Dropped lines:** `qty` null or ≤ 0, after `round6`.
  - **Duplicates:** kept as separate lines.
- `createScannedReportAction({ investmentId, workerId, pages, mediaIds })` on `investmentAction`:
  - refuse a szablon;
  - `readReportTarget` + `reportShareRefusal`;
  - refuse a blocked `resolveWorkerScope`;
  - refuse an empty result;
  - insert with `source: 'scan'` and `createdById`;
  - return `{ reportId }`;
  - entity tags via `investmentEntityOpts`;
  - `after(translateReportExtras)`.

### Success Criteria:

#### Automated Verification:

- The migration applies and rolls back locally.
- Unit spec `src/__tests__/lib/kosztorys/worker-report/resolve-scan.test.ts`:
  - a valid ref resolves;
  - a bad check digit or an unknown ref → unassigned with `scanned_ref`;
  - a duplicate ref → two lines;
  - a unit outside the list → `''`;
  - qty ≤ 0 or null is dropped;
  - „2,5" is not this module's job (the qty arrives as a number).
- DB spec `src/__tests__/lib/actions/worker-report-scan.db.test.ts`:
  - creates a `pending` report with `source = 'scan'`, `created_by_id`, flags and media;
  - refuses a szablon, an inactive worker and a blocked scope;
  - `listWorkerReports(..., { linkOnly: true })` omits it, while the editor list includes it.
- DB spec: the media guards refuse deleting, and skip reclaiming, a photo held by a report.

#### Manual Verification:

- None in this phase (no UI yet).

---

## Phase 4: AI read

### Overview

A management-only route reads one photo and returns rows and extras. It persists nothing.

### Changes Required:

#### 1. Reader

**File**: `src/lib/ai/worker-report-scan.ts` (+ a schema file beside it)

**Intent**: the receipt reader's call, with this schema and prompt.

**Contract**:

- `readWorkerReportPage(file, { units: { value: string, label: string }[] })` → `ScanPageT`.
- Schema factory: `z.enum(units)` for an extra's unit (or null). A row's `ref` is a string exactly as
  printed, including the check digit, plus an optional printed `description`.
- Prompt:
  - only printed rows with a handwritten quantity;
  - „2,5" = 2.5;
  - an unclear digit → best guess plus `isUncertain`;
  - the unit list given as `m2 — м²` lines (`translateUnit`), returning the Polish value.
- Uses `openrouter`, `timeoutSignal`, `withModelFallback` and `RECEIPT_MODEL` as they are. Move
  `receiptErrorDetail` to a shared module and import it from both readers.

#### 2. Route

**File**: `src/app/(frontend)/api/read-worker-report/route.ts`

**Intent**: a multipart POST of one compressed photo plus `investmentId` and `workerId`.

**Contract**:

- Gate: `requireAuth(MANAGEMENT_ROLES)`.
- It builds the unit list (`unitOptions` + the worker's language) on the server from the tree, and
  returns `ScanPageT` or a readable error.
- `maxDuration` as `extract-receipt`.

### Success Criteria:

#### Automated Verification:

- Unit spec for the schema factory: a unit outside the list is rejected, and null is accepted.
- Route spec, AI stubbed: a non-management session gets 403; a valid post returns the stubbed page.

#### Manual Verification:

- A real photo of a filled form (local, against the dev OpenRouter key): rows come back with the
  right refs and quantities, and a deliberately smudged digit comes back `isUncertain`.

---

## Phase 5: Scan dialog + entry points

### Overview

One dialog serves both entry points: pick the photos, read each, create, open verification.

### Changes Required:

#### 1. Dialog

**File**: `src/components/worker-reports/scan-report-dialog.tsx` (+ a colocated hook if needed)

**Intent**: built on `ExpenseDraftDialog`.

**Contract**:

- Pick the photos with `useFilePickIngest` (INVOICE profile, ≤ 12).
- Show thumbnails, using `useObjectUrls` promoted to `src/hooks/`.
- On „Wczytaj": POST each photo to the route, 2–3 at a time, behind the `usePendingStore` pill and a
  disabled „Odczytywanie kartki…" button; closing is blocked while sending.
- A failed page offers a retry of that page alone.
- Then `submitWithUploads(files, ids => createScannedReportAction(...), 'inne')`.
- Props: `investmentId?` and `workerId?` (whichever the entry point knows), and
  `onCreated(reportId, investmentId)`.

#### 2. Listing entry

**Files**: `src/components/worker-reports/worker-reports-data-table.tsx`,
`src/lib/db/stage-memberships.ts`, `src/lib/queries/worker-reports.ts`,
`src/lib/kosztorys/worker-report/report-param.ts`

**Intent**: a „Wczytaj z kartki" toolbar action. The worker picker then lists investments (both
`SearchSelect`); after creation it navigates to the report.

**Contract**:

- `listWorkersWithActiveStages(db)` plus `'use server'` reads for it and for the worker's
  investments (`listWorkerStageInvestments`).
- `reportHref(investmentId, reportId)` replaces the inline href at
  `worker-reports-data-table.tsx:44-45`.

#### 3. Editor entry

**Files**: `kosztorys-actions-context.tsx`, `kosztorys-workers-menu.tsx`

**Intent**: a per-worker „Wczytaj z kartki" item, disabled when blocked, opens the dialog. After
creation it calls `workerReports.openReport(reportId)`.

**Contract**: a `scan` slot in `KosztorysActionsProvider`, shaped like `requestShare`.

### Success Criteria:

#### Automated Verification:

- DOM spec `src/__tests__/components/worker-reports/scan-report-dialog.test.tsx`, with the action
  and fetch mocked:
  - the submit stays disabled until a worker, an investment and ≥ 1 photo are set;
  - a failed page read shows a retry, and no upload happens;
  - success calls `onCreated` with the report id.
- DB spec for `listWorkersWithActiveStages`: an inactive worker, a szablon and a closed investment
  are excluded.

#### Manual Verification:

- Zgłoszenia prac → „Wczytaj z kartki" → worker → investment → 2 photos → the editor opens on that
  zgłoszenie's verification.
- Editor → Pracownicy → worker → „Wczytaj z kartki" → photos → verification opens in place, and the
  pending count goes up.
- The worker's `/z/` link does not list the scanned zgłoszenie.

---

## Phase 6: Verification

### Overview

The review dialog shows the photos, flags, and who scanned. „Zaznacz wszystkie" skips duplicates,
and the extra-without-j.m. rule holds on both sides.

### Changes Required:

#### 1. Types + mapping

**Files**: `src/lib/kosztorys/worker-report/types.ts`, `src/lib/queries/worker-reports.ts:31-69`

**Intent**: carry `source`, `createdByName`, `photos`, `line.isUncertain` and `line.scannedRef` to
the client.

**Contract**: `WorkerReportT` and `ReportLineT` gain those fields.

#### 2. Review

**Files**: `worker-report-review.tsx`, `review-lines-table.tsx`, `line-draft.ts`

**Intent**: everything the kierownik needs to check the lines against the paper.

**Contract**:

- Photo pane: `sm:grid-cols-[1fr_minmax(0,22rem)]` around the lines scroll, with `MediaStrip` →
  `MediaPreviewDialog`. Set `sizes` to the pane width.
- `ReviewRowT` gains `isUncertain`, `isDuplicateItem` and `isUnitMissing`, shown in
  `RozpiskaDescriptionCell` / `ManualDescriptionCell`.
- An unassigned line with `scannedRef` reads „Nr {ref} nie pasuje do rozpiski" instead of „Pozycja
  usunięta z rozpiski".
- The header shows „Wczytane z kartki przez {name}" when `source = 'scan'`.
- „Zaznacz wszystkie" leaves out `isDuplicateItem` lines.
- `isLineReady`: an extra with `unit === ''` needs a `catalogueId`.

#### 3. Server accept rule

**File**: `src/lib/actions/accept-worker-report.ts:221-232`

**Intent**: an extra with an empty unit that mints a pozycja without a katalog praca is refused.

**Contract**: the extras loop refuses `catalogueItemId === undefined && line.unit.trim() === ''`,
with a readable message.

### Success Criteria:

#### Automated Verification:

- DB spec, extending `accept-worker-report` specs: accepting an extra with `unit = ''` and no
  catalogue is refused; with a catalogue it creates a pozycja with the catalogue's j.m.
- Unit spec for `isLineReady`: a no-unit extra isn't ready without a catalogue.
- DOM spec for the review: the flags render; „Zaznacz wszystkie" skips duplicate lines; the scan
  header line shows.

#### Manual Verification:

- A scanned zgłoszenie: the photos sit beside the lines and open enlarged.
  - A line with an unclear quantity shows „niepewny odczyt".
  - A number photographed on two pages shows two flagged lines, and „Zaznacz wszystkie" ticks
    neither.
- A praca spoza rozpiski in a unit not in the kosztorys: flagged, and „Zatwierdź" refuses until a
  katalog praca is chosen.
- A number with a wrong check digit lands in „do przypisania" with the number shown, and can be
  re-pointed.
- A form printed before „Przywróć wersję", scanned after it: its rows still resolve.

---

## Testing Strategy

### Unit Tests:

- Damm (`check-digit`), the scan resolver, the schema factory, the form builder, snapshot tolerance,
  the import carry, `isLineReady`.

### Integration Tests:

- DB specs under `src/__tests__` (discovered by `scripts/test-integration.sh`):
  - the `ref` lifecycle;
  - the scanned-report action, its gates and the `/z/` filter;
  - the media guards;
  - the accept rule;
  - `listWorkersWithActiveStages`.

### E2E:

- A browser-level slice owes its E2E: the scan → verification path, with the AI route stubbed. Author
  it at the review gate, or defer it to an `e2e-backlog` Linear issue.

### Manual Testing Steps:

1. Print „Drukuj do wypełnienia" for a worker, fill in a few quantities, add one praca spoza
   rozpiski, and photograph it in two shots.
2. Scan from „Zgłoszenia prac" and check the lines against the photos.
3. Accept, and check the etap quantities in the editor.

## Performance Considerations

- The AI reads run 2–3 in parallel, each with the receipt reader's timeout.
- `ref` has a unique index, so a lookup is cheap. The resolver reads the tree once per scan.

## Migration Notes

- Two additive hand-written migrations. Prod is migrated before the push that ships the code, by a
  human (`pnpm db:migrate:prod`).
- Existing pozycje get `ref = id`, so nothing printed before is affected (no form exists yet).

## Whole-tree Gate

- Typecheck: `pnpm typecheck`.
- Lint: `pnpm lint`.
- Unit + DOM: `pnpm test`.
- DB-backed: `pnpm test:integration`.

## References

- Decisions: `context/changes/2026-10-05-worker-report-scan/change.md`.
- Research: `context/changes/2026-10-05-worker-report-scan/research.md` (follow-up section A–F).
- Precedents:
  - `src/lib/kosztorys/print/worker.ts:95-144`;
  - `src/lib/ai/openrouter.ts`;
  - `src/migrations/20261005_3_add_worker_expense_drafts.ts`;
  - `src/components/worker-expenses/expense-draft-dialog.tsx`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stable number + check digit

#### Automated

- [x] 1.1 Migration applies and rolls back locally — 434a1e76
- [x] 1.2 check-digit unit spec — 434a1e76
- [x] 1.3 Snapshot tolerance + import carry unit specs — 434a1e76
- [x] 1.4 item-ref DB spec (restore keeps, szablon/add mint, unique) — 434a1e76

### Phase 2: „Drukuj do wypełnienia"

#### Automated

- [x] 2.1 worker-form print unit spec — 4ae2da12

### Phase 3: Data model + create action

#### Automated

- [x] 3.1 Migration applies and rolls back locally — ed244944
- [x] 3.2 resolve-scan unit spec — ed244944
- [x] 3.3 worker-report-scan action DB spec (create, gates, /z/ filter) — ed244944
- [x] 3.4 Media guards DB spec — ed244944

### Phase 4: AI read

#### Automated

- [x] 4.1 Schema factory unit spec
- [x] 4.2 Route spec (role gate, stubbed read)

### Phase 5: Scan dialog + entry points

#### Automated

- [ ] 5.1 scan-report-dialog DOM spec
- [ ] 5.2 listWorkersWithActiveStages DB spec

### Phase 6: Verification

#### Automated

- [ ] 6.1 Accept rule DB spec
- [ ] 6.2 isLineReady unit spec
- [ ] 6.3 Review flags DOM spec
