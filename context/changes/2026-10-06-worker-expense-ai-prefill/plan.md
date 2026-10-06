# Worker expense AI prefill (EX-1001) Implementation Plan

## Overview

When a worker sends an expense draft, the server reads its photos with AI in `after()` and stores
the result on the draft. The manager's „Nowy wydatek" dialog then opens already filled in. A
„Odczytaj dodane zdjęcia" button re-reads attached photos when the stored read failed or had not
finished. The worker chooses „Jeden wydatek" / „Kilka wydatków" when sending, the same choice the
manager's form already offers. This replaces the uncommitted on-open `useEffect` stopgap in
`expense-form.tsx`.

## Current State Analysis

- A worker's send stores the photos and the note only (`sendExpenseDraftAction`,
  `src/lib/actions/worker-expense-drafts.ts:61-83`). Nothing reads the photos.
- `PendingExpenseDrafts.handleOpen` (`src/components/worker-expenses/pending-expense-drafts.tsx:63-95`)
  downloads the pages, hangs all of them on one blank row (`files: new Map([[0, files]])`) and
  opens the form. The form's only AI entry point, „Wygeneruj z paragonów", opens a picker for NEW
  photos, so in practice no path reads the draft's own photos. The stopgap effect
  (`expense-form.tsx:275-283`) closes the gap from the wrong place.
- The AI core is already bytes-based: `extractReceipt(pages: ReceiptPageT[], names)`
  (`src/lib/ai/openrouter.ts:47`). Only `scanReceipt`'s `File → page` step
  (`src/lib/ai/scan-receipt.ts:19-27`) is browser-shaped.
- Draft reads are uncached (`src/lib/queries/worker-expense-drafts.ts:17-27`), so a write in
  `after()` needs no revalidation.
- Full map: `research.md`.

## Desired End State

- A worker sends 1–8 photos. With 2 or more photos a toggle „Jeden wydatek" / „Kilka wydatków"
  appears, defaulting to „Jeden wydatek". The send returns as soon as the photos and note are
  stored, and the AI read runs in `after()`.
- Adding or removing a photo, or changing the mode in „Edytuj", clears the stored read and starts
  a new one. A read that finishes after such a change is discarded by the database write guard.
- The manager clicks „Zobacz". In „Jeden wydatek" mode the dialog shows one row holding every
  page; in „Kilka wydatków" mode it shows one row per photo. Each row is filled from the stored
  read (Opis, kwota, netto, notatka) and its files carry the AI's file names. A row the AI did not
  read (failed, unreadable, or not finished yet) opens blank.
- Whenever a row has files attached but an empty Opis and kwota, the form shows „Odczytaj dodane
  zdjęcia", which reads exactly those rows.
- No AI call is made when the dialog opens.

### Key Discoveries:

- `after()` precedent: `after(() => translateReportExtras(db, reportId))`
  (`src/lib/actions/worker-report.ts:67`). The callback is a `server-only` module in `lib/actions`
  that catches everything and calls `logError` (`src/lib/actions/translate-report-lines.ts:27`).
- Direct public Blob URL: `https://<storeId>.public.blob.vercel-storage.com/${encodeURIComponent(filename)}`
  (`src/scripts/backfill-heic-media.ts:178-182`). The store id is the token segment after
  `vercel_blob_rw_` (`src/lib/env/schema.ts:40`).
- The manager form's mode type and labels are module-private in `line-items-field.tsx:52-62`
  (`ScanModeT`, `SCAN_MODE_OPTIONS`, `SCAN_MODE_HINT`).
- `prefill.files` is positional, `Map<rowIndex, File[]>`, and is re-keyed to row ids by
  `useInvoiceIngest` (`use-invoice-ingest.ts:36-40`). N rows therefore need N map entries in the
  same order as `values.lineItems`.
- `pageFilename` (`use-invoice-files.ts:134`) builds the page-suffixed name and is private.
- `worker-expense-drafts.db.test.ts:12-16` stubs `after: () => {}` on purpose: the accept path's
  `after()` runs the live sheet sync. Collect-and-flush pattern: `worker-report.test.ts:14-18`.
- Worker strings are translated (pl / uk / ru dictionaries, `useTranslation('expenseDrafts')`).

## What We're NOT Doing

- No AI-status indicator in the manager's pending list (owner, 2026-10-06).
- No change to the receipt model, the fallback, or the manager's client scan path
  (`/api/extract-receipt`).
- No splitting or merging of rows when the worker picked the wrong mode. The manager fixes it by
  hand or deletes and re-scans.
- No category from the AI. It is not applied today either (`apply-receipt-to-row.ts:8-9`).
- No gate or spend cap on OpenRouter (`outgoing-effects-isolation.md:70-78`).
- No live refresh of an open dialog when a read lands. The re-read button is the answer
  (EX-971 review-gate :28).
- No E2E in this change. It is folded into EX-997.

## Implementation Approach

The read is a single server function, `readExpenseDraftReceipts(db, draftId)`. It loads the
draft's pages and mode, fetches the bytes from Blob, runs one AI read (one-invoice) or one read
per page (one-per-photo, concurrency 4), and writes the result through a compare-and-set
statement. Every statement that changes the pages or the mode clears `ai_read` in the same SQL,
and every action that runs such a statement schedules the read in `after()`. As a result the
stored read always describes the current pages or is NULL. Nothing checks staleness at read time.

## Critical Implementation Details

- **Write guard, not a check.** The read takes up to about 120 s, and the worker can remove a page
  meanwhile. The write lands only when the draft is still `pending`, has the same `scan_mode`,
  and its ordered page ids equal the ids that were read. Otherwise it updates 0 rows and the
  result is dropped silently. Clearing on change plus this guard makes a late answer lose
  (domain notes :542-547).
- **The `after()` callback never throws.** Catch everything and send it to `logError` with a
  `// TODO(EX-449) SENTRY-REQUIRED:` marker. The worker's send has already succeeded.
- **Do not wrap this `after()` in the inline fallback** (`try { after } catch { await fn() }`).
  Outside a request it would block a script or a spec for a minute and bill a real read. Call
  plain `after()`, as `worker-report.ts:67` does.

## Phase 1: Schema and server-side read

### Overview

Store the mode and the read on the draft, clear the read on every change, and run the read in
`after()` from the four worker actions.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261006_1_add_worker_expense_draft_read.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Additive columns for the worker's mode choice and the stored read. Hand-written, in the
style of `20261005_6_add_worker_report_scan.ts`.

**Contract**: `worker_expense_drafts` gains `scan_mode varchar NOT NULL DEFAULT 'one-invoice'`
with a CHECK on `('one-invoice', 'one-per-photo')`, and `ai_read jsonb` (nullable). Use
`IF NOT EXISTS`. `down` drops both. Existing rows get `one-invoice`, which matches today's
one-row prefill. Prod migrate BEFORE push.

#### 2. Shared mode constant

**File**: `src/lib/constants/receipt-scan-mode.ts` (new); `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: One `ScanModeT` for the database layer, the worker dialog and the manager form. Move the
type, the `RECEIPT_SCAN_MODES` tuple and the Polish `SCAN_MODE_OPTIONS` / `SCAN_MODE_HINT` out of
`line-items-field.tsx` and import them back there.

**Contract**: `export const RECEIPT_SCAN_MODES = ['one-invoice', 'one-per-photo'] as const;
export type ScanModeT = (typeof RECEIPT_SCAN_MODES)[number]`.

#### 3. Page cap

**File**: `src/lib/constants/worker-expense-drafts.ts`

**Intent**: `MAX_DRAFT_PAGES` 20 → 8, so a draft is always readable in one call
(`MAX_RECEIPT_PAGES = 8`). Express it as `= MAX_RECEIPT_PAGES` so the two cannot drift apart.

**Contract**: The send schema (`.max(MAX_DRAFT_PAGES)`) and `addExpenseDraftPagesAction`'s count check
already read it. No pending draft above 8 pages exists locally (max 7). Re-count on prod before push.

#### 4. DB layer

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Carry the mode and the read on the row, give the read its guarded write, and clear it in
every statement that changes the pages or the mode.

**Contract**:
- Add `scanMode: ScanModeT` and `aiRead: ExpenseDraftReadT | undefined` to `ExpenseDraftRowT`,
  `DRAFT_SELECT` and `toDraftRow`. Parse `ai_read` with a zod schema; an unparseable value maps to
  `undefined`, never a throw.
- `ExpenseDraftReadT = { rows: ExpenseDraftReadRowT[] }`, where `ExpenseDraftReadRowT = { mediaIds:
  number[]; description?: string; amount?: number; netAmount?: number; invoiceNote?: string;
  filename?: string }`. Rows are in page order: one row for one-invoice, one per page for
  one-per-photo. A row the AI did not read carries only `mediaIds`. The type and schema live in
  their own file under `src/lib/db/` or `src/types/`, next to the mapper's import.
- `insertWorkerExpenseDraft` takes `scanMode`.
- `updatePendingExpenseDraft` takes `scanMode`, sets `ai_read = NULL` only when the mode actually
  changes, and returns `{ isUpdated, isScanModeChanged }`. Read the old mode in a CTE, because
  `RETURNING` only sees the new row.
- `appendExpenseDraftPages` / `removeExpenseDraftPage` set `ai_read = NULL` in the same statement
  (data-modifying CTE).
- New `loadExpenseDraftForRead(db, draftId)` returns `{ scanMode, pages: ExpenseDraftMediaT[] }`
  for a pending draft, or `undefined` otherwise.
- New `saveExpenseDraftRead(db, { draftId, scanMode, mediaIds, read })` returns a `boolean`:

```sql
UPDATE worker_expense_drafts d SET ai_read = ${json}
WHERE d.id = ${draftId} AND d.status = 'pending' AND d.scan_mode = ${scanMode}
  AND (SELECT array_agg(dm.media_id ORDER BY dm.position)
       FROM worker_expense_draft_media dm WHERE dm.draft_id = d.id)
      = ARRAY[${sqlList(mediaIds)}]::int[]
```

#### 5. Media bytes from Blob

**File**: `src/lib/media/blob-public-url.ts` (new); `src/scripts/backfill-heic-media.ts`

**Intent**: One builder for the public Blob URL of a stored media filename, shared by the script and
the server read. Add a `fetchMediaBytes(media)` → `ReceiptPageT` beside it, with a timeout and a
thrown error on a non-OK response.

**Contract**: `blobPublicUrl(storeId, filename)`; `blobStoreIdOf(token)` parses
`vercel_blob_rw_<storeId>_…`. The server read takes the token from `serverEnv.BLOB_READ_WRITE_TOKEN`.
The script keeps its own store-identity guards and only reuses the builder.

#### 6. Split `scanReceipt`

**File**: `src/lib/ai/scan-receipt.ts`

**Intent**: Separate the browser-`File` conversion from reading pages, so the server read reuses the
filename build and the netto-range drop unchanged.

**Contract**: `scanReceiptPages(pages: ReceiptPageT[], otherCategoryNames: string[]):
Promise<ReceiptFillResultT>` holds today's body after the conversion. `scanReceipt(files, names)`
converts the files and delegates. `/api/extract-receipt` is untouched.

#### 7. The read

**File**: `src/lib/actions/read-expense-draft-receipts.ts` (new, `import 'server-only'`)

**Intent**: The `after()` callback. It loads the draft, fetches the bytes, reads one invoice or each
page (`mapWithConcurrency`, 4), maps each answer to an `ExpenseDraftReadRowT`, and saves through the
guard.

**Contract**: `readExpenseDraftReceipts(db, draftId): Promise<void>`. It never throws (catch →
`logError` + SENTRY marker). `otherCategoryNames` is `[]`, because the category is never applied.
- `UNREADABLE_RECEIPT` → that row keeps only `mediaIds`, and the manager sees a blank row (owner,
  2026-10-06).
- A failed per-page read in one-per-photo mode → also a bare row; the other pages still land.
- When no row carries any field, it writes nothing (`ai_read` stays NULL).

#### 8. Actions

**File**: `src/lib/actions/worker-expense-drafts.ts`

**Intent**: Accept the mode and schedule the read wherever the pages or the mode changed.

**Contract**:
- `sendDraftSchema` gains `scanMode: z.enum(RECEIPT_SCAN_MODES)`. The update schema inherits it
  through `.omit({ mediaIds })`.
- `after(() => readExpenseDraftReceipts(db, draftId))` is scheduled:
  - in `sendExpenseDraftAction`, after a non-null `draftId`;
  - in `addExpenseDraftPagesAction`, after `isAdded`;
  - in `removeExpenseDraftPageAction`, after `isRemoved`;
  - in `updateExpenseDraftAction`, only when `isScanModeChanged`.
- The result types and messages are unchanged.

#### 9. Specs

**File**:
- `src/__tests__/lib/actions/read-expense-draft-receipts.db.test.ts` (new)
- `src/__tests__/lib/media/blob-public-url.test.ts` (new)
- `src/__tests__/lib/ai/scan-receipt.test.ts`
- `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`

**Intent**: Prove the read lands, a stale read loses, and the actions schedule it. Mock
`@/lib/ai/openrouter` and `@/lib/media/blob-public-url`'s fetch; no real AI or Blob.

**Contract**:
- **Read spec, against `db-test`:**
  - one-invoice: one row with all ids and fields;
  - one-per-photo: one row per page, the unreadable one bare;
  - all-failed: `ai_read` stays NULL;
  - a page removed between load and save → 0 rows written, and the row shows the clear, not the
    old read;
  - a mode change between load and save → same;
  - a decided draft → no write.
- **Worker action spec:** swap its `after` handling to collect (`worker-report.test.ts:14-18`, not
  flushed) and assert one task is scheduled per send / add / remove / mode change, none on a plain
  note edit; `ai_read` is NULL after add / remove.
- **`scan-receipt.test.ts`:** still green after the split; add one `scanReceiptPages` case.
- Leave `worker-expense-drafts.db.test.ts`'s no-op `after` stub as it is: there it exists for the
  accept path's sheet sync, and the read has its own spec.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB and to `db-test`: `pnpm payload migrate` (run `git status src/migrations` first)
- Read spec passes: `pnpm exec vitest run src/__tests__/lib/actions/read-expense-draft-receipts.db.test.ts`
- Worker action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`
- Blob URL + scan-receipt specs pass: `pnpm exec vitest run src/__tests__/lib/media/blob-public-url.test.ts src/__tests__/lib/ai/scan-receipt.test.ts`

#### Manual Verification:

- Local, as a worker, with `OPENROUTER` live: send a draft with 2 receipt photos in „Kilka
  wydatków"; within about a minute `ai_read` on that draft has 2 rows with Opis and kwota
  (psql on 5433).
- Remove one photo in „Edytuj": `ai_read` goes NULL at once, then refills with 1 row.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Worker chooses the mode

### Overview

The worker's send and edit dialogs offer the same choice as the manager's form.

### Changes Required:

#### 1. Draft dialog

**File**: `src/components/worker-expenses/expense-draft-dialog.tsx`

**Intent**: Show a `ToggleGroup` of the two modes (with its hint line) when the dialog holds 2 or
more photos: `files.length` on a new send, `draft.media.length` in „Edytuj". The default is
„Jeden wydatek"; in „Edytuj" it starts from `draft.scanMode` and resets to it on reopen, like the
other fields. Send `scanMode` with both actions. With 1 photo, send `one-invoice`.

**Contract**: The mode is local `useState<ScanModeT>`. The `ToggleGroup` primitive is the one
`line-items-field.tsx` uses.

#### 2. Strings

**File**: `src/lib/i18n/dictionaries/pl.ts`, `uk.ts`, `ru.ts`

**Intent**: Worker-facing labels and hints for both modes under `expenseDrafts`. The Polish wording
matches the manager's („Jeden wydatek" / „Kilka wydatków" + hints).

**Contract**: Four new keys in each dictionary. `uk` / `ru` are translations of the Polish.

#### 3. Spec

**File**: `src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx` (new)

**Intent**: The toggle is absent with 1 photo and present with 2. The default and a switched mode
reach the action. „Edytuj" starts from the draft's mode.

**Contract**: DOM project; `vi.mock` the two actions and `submitWithUploads`.

### Success Criteria:

#### Automated Verification:

- Dialog spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx`
- The existing language spec still passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-language.test.tsx`

#### Manual Verification:

- At 390px, as a worker: pick 1 photo → no toggle; pick 3 → the toggle and its hint fit without
  horizontal scroll; the uk worker sees Ukrainian labels.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Manager prefill and the re-read button

### Overview

„Zobacz" builds the rows from the stored read. The form gets the re-read button, and the stopgap
goes.

### Changes Required:

#### 1. Pure mapping

**File**: `src/components/forms/expense-form/apply-receipt-to-row.ts`

**Intent**: Extract `receiptToLineItemValues(read)` → `{ description, amount, netAmount, invoiceNote }`
as form strings. `applyReceiptToRow` writes through it, so the client scan and the stored read
fill a row identically.

**Contract**: It accepts the shared subset of `ReceiptFillResultT` and `ExpenseDraftReadRowT`;
absent fields → `''`.

#### 2. Page filename

**File**: `src/components/forms/expense-form/use-invoice-files.ts` → `src/lib/utils/receipt-filename.ts`

**Intent**: Move `pageFilename` beside `buildReceiptFileName` and export it, so `handleOpen` names
the downloaded pages the way „Generuj" would.

**Contract**: Same signature `(name, index)`; `use-invoice-files.ts` imports it.

#### 3. Prefill from the read

**File**: `src/components/worker-expenses/pending-expense-drafts.tsx`

**Intent**: Build `values.lineItems` and the positional `files` map from `draft.scanMode` and
`draft.aiRead`:
- one-invoice → one row, all pages;
- one-per-photo → one row per page, in page order.

Each row takes `receiptToLineItemValues` of the read row whose `mediaIds` match, or stays blank.
A read row's `filename` renames that row's files through `pageFilename`. Every row keeps the
default `expenseCategory`.

**Contract**: Put the row-building in a pure function in its own file
(`src/components/worker-expenses/draft-prefill.ts`) taking `(draft, files, expenseCategory)`, so it
is unit-testable without rendering.

#### 4. „Odczytaj dodane zdjęcia"

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: An `ai`-variant button in the `onGenerate &&` block. It shows when some row has files and
an empty Opis and kwota, calls `onGenerate`, and is disabled like „Wygeneruj z paragonów". Remove
the unreachable empty-pick branch of `scanReceipts` (`:185-205`), which this button replaces.

**Contract**: Visibility is derived on render from `lineItemsField.state.value` and `getRowFiles`.
No new prop.

#### 5. Remove the stopgap

**File**: `src/components/forms/expense-form/expense-form.tsx`; `src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx`

**Intent**: Delete the mount effect and its ref (and the `useEffect` / `useRef` imports if unused).
Turn the stopgap test around: opening a prefilled form makes NO scan call, and the button reads the
blank row on click.

#### 6. Specs

**File**: `src/__tests__/components/worker-expenses/draft-prefill.test.ts` (new); `expense-form-prefill.test.tsx`

**Contract**:
- **`draft-prefill`:**
  - one-invoice with a read → one filled row;
  - one-per-photo with a partial read → filled + blank rows in page order, files positional;
  - no read → blank rows by mode;
  - the AI filename applied with page suffixes.
- **`expense-form-prefill`:** a prefilled row with values renders them; a blank row with files shows
  the button; a click calls `scanReceiptClient` once with that row's files; a filled row hides it.

#### 7. Docs

**File**:
- `context/foundation/manual-checks.md` (rolled up by `/10x-implement`)
- `context/foundation/test-plan.md`
- `context/reference/outgoing-effects-isolation.md`

**Intent**:
- **Test plan:** add risk #24 — „An AI read describes photos no longer on the draft, or lands after
  them and overwrites the read of the current ones".
- **Outgoing effects:** add one line saying that a worker's send now triggers a billed OpenRouter
  read from every environment, deliberately ungated.
- **Manual checks:** the EX-971 checks at `manual-checks.md:3853-3856` („kwota pusta", „Generuj …
  wgranie zdjęcia") are superseded by this phase's checks.
- **EX-997:** add the worker-send → manager-opens-prefilled path to its description.

### Success Criteria:

#### Automated Verification:

- Prefill builder spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/draft-prefill.test.ts`
- Form spec passes: `pnpm exec vitest run src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx`
- Line-items specs still pass: `pnpm exec vitest run src/__tests__/components/forms/expense-form`

#### Manual Verification:

- Staging: a worker sends 2 photos of one receipt („Jeden wydatek"); after a minute the manager
  clicks „Zobacz" → one row with Opis, kwota and netto filled, the file named from the Opis
  (`-2` on page 2), and no „Odczytywanie paragonów…" pill on open.
- Staging: a worker sends 3 separate receipts („Kilka wydatków") → three rows, each with its own
  photo and figures.
- The manager clicks „Zobacz" within seconds of the send → blank row(s) and „Odczytaj dodane
  zdjęcia"; a click fills them.
- A receipt the AI cannot read → its row opens blank and the button reads it on demand.
- The worker removes a photo after the read → the manager's dialog shows the remaining photo's
  figures, not the removed one's.
- The regular „Nowy wydatek" dialog: attach a file to a row through its FV input with an empty
  Opis → the button appears and reads it.

**Implementation Note**: The final phase. `/10x-implement` rolls the manual bullets into the registry.

---

## Testing Strategy

### Unit Tests:

- `draft-prefill` row building (mode × read shape), `blobPublicUrl` / `blobStoreIdOf`, and the
  `scanReceiptPages` split.

### Integration Tests:

- The read against `db-test` with mocked AI and bytes: both modes, a partial failure, the stale
  guard after a page change or mode change, and the decided-draft refusal.
- The worker actions schedule the read exactly where the pages or the mode change and clear
  `ai_read`.

### Manual Testing Steps:

The bullets under each phase. Real AI reads cost money, so do them on staging with few photos.

## Performance Considerations

The worst case is one-per-photo with 8 pages at concurrency 4: two waves of at most 60 s, so about
120 s. A one-invoice read of 8 pages takes at most 270 s. Both fit the 300 s ceiling that `after()`
counts toward. Every page add or remove triggers a full re-read: cents per change, accepted for
simplicity.

## Migration Notes

The migration is additive, so `pnpm db:migrate:prod` runs BEFORE the push (human). Existing drafts
get `scan_mode = 'one-invoice'` and `ai_read = NULL`: they open as today, blank, now with the
re-read button. Re-count prod drafts above 8 pages before shipping the cap; any found stay readable
only through the button, reading at most 8 pages.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration` (only when asked — the user runs full suites)

## References

- Research: `context/changes/2026-10-06-worker-expense-ai-prefill/research.md`
- `after()` precedent: `src/lib/actions/worker-report.ts:67`, `src/lib/actions/translate-report-lines.ts:27`
- Prior change: `context/archive/2026-10-05-worker-expenses/`
- Linear: EX-1001 (this), EX-971 (parent), EX-997 (E2E backlog)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and server-side read

#### Automated

- [x] 1.1 Migration applies to the local DB and to `db-test` — 9e70c1e9
- [x] 1.2 Read spec passes — 9e70c1e9
- [x] 1.3 Worker action spec passes — 9e70c1e9
- [x] 1.4 Blob URL + scan-receipt specs pass — 9e70c1e9

### Phase 2: Worker chooses the mode

#### Automated

- [x] 2.1 Dialog spec passes
- [x] 2.2 The existing language spec still passes

### Phase 3: Manager prefill and the re-read button

#### Automated

- [ ] 3.1 Prefill builder spec passes
- [ ] 3.2 Form spec passes
- [ ] 3.3 Line-items specs still pass
