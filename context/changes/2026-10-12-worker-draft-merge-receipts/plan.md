# Merge and split paragon rows in the „Przyjmij” dialog — Implementation Plan

Linear: EX-1048 · Research: `context/changes/2026-10-12-worker-draft-merge-receipts/research.md`

## Overview

A worker's zgłoszenie is always read paragon by paragon, and the manager merges rows into one
transakcja by hand („Połącz zaznaczone”) or splits a merged row back („Rozłącz”). „Jeden wydatek”
leaves the worker's dialog entirely. Trigger: prod zgłoszenie #13 — 24 parking bileciki the owner
wants booked as ONE transakcja; the single-document read gave 257.50 / null / 286.90 zł for a true
287.90 zł, while a per-paragon read summed in code is exact.

## Current State Analysis

- The worker picks „Jeden wydatek” / „Kilka wydatków” (`expense-draft-dialog.tsx:72,114,198-226`),
  stored as `worker_expense_drafts.scan_mode`. `readExpenseDraftReceipts`
  (`read-expense-draft-receipts.ts:70-78`) reads a multi-photo `one-invoice` draft as ONE document.
- The prefill (`draft-prefill.ts:26-66`) groups pages by mode and matches read rows to groups with
  ordered `sameItems`; one line item = one read row, recorded as `receipts: Map<itemId, DraftReceiptT>`
  (`{ mediaIds, readRow? }`), a static Map on `ExpenseFormPrefillT` (`expense-form.tsx:79-84`).
- `receiptDecision` (`receipt-decision.ts:9-24`) books kept items positionally and turns every
  receipt whose item is gone into a skipped receipt. A merge that only edited the form would make the
  server record the merged-away paragony as „odrzucone”.
- `decideExpenseDraft` (`worker-expense-drafts.ts:342-389`) stores a booked link as
  `(transfer_id, draft_id, media_ids)` — it knows the photos, not which paragony. Two transakcje
  booked from one photo are indistinguishable, so the duplicate check cannot tell which paragony sit
  behind a transakcja.
- Duplicate hints resolve `paragon.readRow → itemId` once, at load, against the prefill's receipts
  (`use-expense-draft-acceptance.tsx:132-136`); a merge would leave them pointing at removed ids.
- No row selection, no „replace this row's files” setter (`use-invoice-files.ts`), no way to hide
  „Odczytaj ponownie” per row (`line-items-field.tsx:367-378`).

## Desired End State

- The worker's dialog has no mode toggle; every new draft is stored `one-per-photo` and read per
  photo.
- „Przyjmij” opens one row per AI read row, plus a blank row for any photo no read row covers. An old
  draft whose stored read is one row over all photos (#13, #21 locally) opens as that one row.
- Rows backed by the zgłoszenie carry a checkbox; „Połącz zaznaczone” (≥2 selected) replaces them with
  one row: Kwota/Netto = sum of what the rows show, all their photos (a shared photo once). A merged row
  shows „Rozłącz” instead of „Odczytaj ponownie”, and „nie odczytano” when any merged paragon had no
  Kwota. „Rozłącz” restores one row per paragon from the stored read.
- Saving books one transakcja per row; removing a merged row (trash or „Duplikat”) records one
  skipped receipt per paragon, so the worker's history and „Przywróć” stay per paragon. Every read row
  of the draft ends up booked or skipped.
- A paragon sent again after it was booked inside a merged transakcja is flagged as a duplicate of that
  transakcja.

### Key Discoveries:

- `98ee7f439`: every paragon needs its OWN `mediaIds` array — the server-action decoder counts a shared
  array once per reference and ~20 paragony tripped its nesting limit. Merged unions and split rows
  must build fresh arrays too.
- The read is immutable once stored (first-writer-wins, `saveExpenseDraftRead`), so a split rebuilt
  from `aiRead.rows` is always exact.
- `failedIds` already renders „nie odczytano” per row (`line-items-field.tsx:331-340`) — the merged
  flag reuses it.
- `restoreSkippedReceipt` (`worker-expense-drafts.ts:413-446`) restores a skipped receipt's read row
  only when the media ids match as a set — fan-out keeps every skipped receipt one paragon, so it needs
  no change.
- The management form reads `pl.expenseDrafts.scanModeOneInvoice*` labels/hint
  (`line-items-field.tsx:59-65`) — those stay; only the worker confirm strings die.

## What We're NOT Doing

- „Jeden wydatek” / „Generuj” in the management „Nowy wydatek” form — untouched (`extractReceipt`
  via `/api/extract-receipt` stays).
- Dropping the `scan_mode` column or rewriting old drafts' value.
- A paragon the AI leaves out entirely (illegible total — the `extractReceipts` prompt skips it). It
  produces no row at all, merged or not; a separate issue, not this change.
- Re-reading a merged row („Odczytaj ponownie” is hidden; „Rozłącz” first).
- Merging rows the manager added by hand (no checkbox on a row without a paragon behind it).
- Preserving manual edits across „Rozłącz” — a split restores the AI read.
- A fixture for a multi-page invoice read per photo (none has ever arrived) — risk row only.

## Implementation Approach

The UI groups, the database keeps one fact per paragon. A line item maps to a list of **parts** — the
existing single-paragon `DraftReceiptT` (`{ mediaIds, readRow? }`) — instead of to one receipt.
Booking sends the union of a row's photos plus its read rows; skipping fans a row out into one skipped
receipt per part. The merge/split arithmetic is React-free in `src/lib/worker-expenses/`; the live
parts state and the form/file-map surgery sit in one hook under `forms/expense-form/` (its only
consumer). The link table gains a nullable `read_rows int[]` so a booked transakcja names its
paragony exactly — additive, hand-written migration.

## Critical Implementation Details

- **State sequencing (merge):** the parts map, the form's `lineItems` and the file map must change in
  one handler — new merged id inserted at the first selected row's position, merged-away ids removed
  from all three. A merged-away id left in the parts map is booked as „odrzucony” at save.
- **Duplicate hints resolve at render, not at load:** hints keep `readRow`; the form maps it to the
  current item through the live parts map, so a merge/split never strands a hint.
- **Deploy order:** the migration is additive — a human runs `pnpm db:migrate:prod` BEFORE the push
  that ships Phase 4's write of `read_rows`.

---

## Phase 1: Always read per photo; prefill from the read; merge/split core

### Overview

Remove the single-document branch, build the prefill straight from read rows, and add the pure
merge/split functions every later phase calls.

### Changes Required:

#### 1. Draft reader

**File**: `src/lib/actions/read-expense-draft-receipts.ts`

**Intent**: Every unread draft is read photo by photo, whatever its stored `scan_mode`.

**Contract**: `isInvoice`, `readInvoice` and the `MAX_RECEIPT_PAGES` early return go; `scanReceiptPages`
stays exported for `/api/extract-receipt` callers only if still used (gate on typecheck).

#### 2. Merge/split core

**File**: `src/lib/worker-expenses/merge-receipts.ts` (new)

**Intent**: Pure functions over line-item values and parts, testable without rendering.

**Contract**:
- `mergeLineItems(items: BulkLineItemT[]): { values; isAmountIncomplete: boolean }` — Kwota/Netto
  summed in grosze from the strings the rows show (blank = 0); Netto blank unless every row has one;
  `isAmountIncomplete` when any row's Kwota is blank; description / documentDate / sellerNip /
  category / expenseCategory / worker from the first row that has them; `invoiceNote` joined with
  newlines; `documentNumber` kept only when every non-blank one is equal.
- `bookedReceipt(parts: DraftReceiptT[]): { mediaIds: number[]; readRows: number[] }` — de-duplicated
  union of `mediaIds` in first-seen order (fresh array) and the parts' `readRow`s.

#### 3. Prefill from read rows

**File**: `src/components/worker-expenses/draft-prefill.ts`

**Intent**: One line item per `aiRead.rows[i]` (its own pages, renamed by its `filename`), then one
blank line item per photo no read row names; no read → one blank row per photo. `scanMode` leaves the
input. Expose the per-row builder so a split reuses it.

**Contract**: `buildDraftPrefill(draft: Pick<…, 'media' | 'aiRead'>, files, expenseCategory)` returns
`receipts: Map<itemId, DraftReceiptT[]>` (one part per row today) plus `pagesByMediaId:
Map<number, File>`; `lineItemForPart(part, read, pagesByMediaId, expenseCategory)` builds one row and
its pages. Every part's `mediaIds` is its own array.

#### 4. Decision fan-out

**File**: `src/lib/worker-expenses/receipt-decision.ts`

**Intent**: Kept rows book through `bookedReceipt`; a removed row yields one skipped receipt per part,
each carrying the row's `duplicateOf` when it was removed as a duplicate.

**Contract**: `receiptDecision(receipts: Map<string, DraftReceiptT[]>, lineItems, duplicateOfByItemId)
→ { receiptMediaIds: number[][]; receiptReadRows: number[][]; skippedReceipts: SkippedReceiptT[] }`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/worker-expenses/merge-receipts.test.ts` — sums in grosze
  (0.1 + 0.2 class), blank Kwota → incomplete, Netto rule, text-field rules, shared photo once, fresh arrays
- `pnpm exec vitest run src/__tests__/components/worker-expenses/draft-prefill.test.ts` — rows from
  read rows, uncovered photo → blank row, old single-row read over all photos → one row, no read → one
  row per photo, distinct `mediaIds` arrays
- `pnpm exec vitest run src/__tests__/lib/worker-expenses/receipt-decision.test.ts` — merged row books
  the union + read rows; removed merged row fans out per part with `duplicateOf`; **every read row
  ends booked or skipped** across merge → split → remove sequences
- `pnpm exec vitest run src/__tests__/lib/actions/read-expense-draft-receipts.db.test.ts` — a
  multi-photo `one-invoice` draft is read per photo (the `:111` single-row expectation flips)

#### Manual Verification:

- An old pending zgłoszenie with one stored row over several photos opens „Przyjmij” as one row with
  all its photos.

---

## Phase 2: Worker's dialog without „Jeden wydatek”

### Overview

The worker no longer chooses a mode; every draft is stored `one-per-photo`.

### Changes Required:

#### 1. Dialog

**File**: `src/components/worker-expenses/expense-draft-dialog.tsx`

**Intent**: Drop the toggle, hint, confirm and `scanMode` state; the send carries no mode.

**Contract**: no `scanMode` in the send payload.

#### 2. Action and store

**File**: `src/lib/actions/worker-expense-drafts.ts`, `src/lib/db/worker-expense-drafts.ts`

**Intent**: The draft insert writes `'one-per-photo'` explicitly (the column default is
`'one-invoice'`); the action schema drops `scanMode` (zod strips it from a stale client).

**Contract**: `createExpenseDraft` no longer takes `scanMode`; reads of `scan_mode` that lose their
last consumer go (gate on typecheck).

#### 3. Copy

**File**: `src/lib/i18n/dictionaries/pl.ts` + the Ukrainian dictionary

**Intent**: Delete the worker-only keys (`scanModeOneInvoiceConfirm*`, and any `scanMode*` key the
worker dialog was its last reader of in a dictionary); the management form's Polish labels/hint stay.

### Success Criteria:

#### Automated Verification:

- `expense-draft-dialog-mode.test.tsx` replaced by a spec asserting no mode control renders at ≥2
  photos and the sent draft is `one-per-photo`
- `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-language.test.tsx`
- `pnpm exec vitest run src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts` — a sent
  draft stores `scan_mode = 'one-per-photo'`

#### Manual Verification:

- Worker on a phone (390px), „Zgłoś wydatek” with 3 photos: no „Jeden wydatek / Kilka wydatków”
  choice; sending works in Polish and Ukrainian.

---

## Phase 3: „Połącz” / „Rozłącz” in the „Przyjmij” dialog

### Overview

Live parts state, row selection, merge and split, with hints and the save following the rows.

### Changes Required:

#### 1. Parts state hook

**File**: `src/components/forms/expense-form/use-draft-receipts.ts` (new)

**Intent**: Owns `Map<itemId, DraftReceiptT[]>` (seeded from the prefill), the selection, and the
incomplete-amount ids; `merge()` and `split(itemId)` update parts, `lineItems` and the file map in one
handler (see Critical Implementation Details). Split rebuilds rows with `lineItemForPart` from
`prefill.aiReadRows` and `prefill.pagesByMediaId`; a part with no read row comes back blank with its
photos. Disabled while generating or ingesting.

**Contract**: `ExpenseFormPrefillT` gains `aiReadRows: ExpenseDraftReadRowT[]` and
`pagesByMediaId: Map<number, File>`; `receipts` becomes `Map<string, DraftReceiptT[]>`.

#### 2. File map setter

**File**: `src/components/forms/expense-form/use-invoice-files.ts` (+ `useInvoiceIngest` pass-through)

**Intent**: One synchronous `commit` that drops a set of row ids and sets the files of new rows.

**Contract**: `replaceRows(removeIds: string[], add: [id: string, files: File[]][])`.

#### 3. Form wiring

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: With a prefill, run the hook, render „Połącz zaznaczone (N)” above the rows, submit
through the new `receiptDecision`, and hand `renderAboveLineItems` an `itemIdOfReadRow(readRow)`
resolver over the live parts.

**Contract**: `renderAboveLineItems` api: `{ lineItemIds, markDuplicate, itemIdOfReadRow }`.

#### 4. Row chrome

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: Optional grouping props: a checkbox on selectable rows, „Rozłącz” on merged rows in place
of „Odczytaj ponownie”, „nie odczytano” for incomplete merged rows via the existing `failedIds` render.
Without the props the management form renders exactly as today.

**Contract**: `receiptGrouping?: { selectableIds; selectedIds; mergedIds; onToggle(id); onSplit(id) }`.

#### 5. Acceptance hook and hints

**File**: `src/components/worker-expenses/use-expense-draft-acceptance.tsx`,
`src/components/worker-expenses/expense-draft-duplicate-hints.tsx`

**Intent**: Hints are stored by `readRow` and resolved to an item at render through
`itemIdOfReadRow`; a hint whose paragon sits in a merged row marks the whole row. The prefill passes
the read rows and the page map.

#### 6. Server action

**File**: `src/lib/actions/transfers.ts`

**Intent**: `opts` carries `receiptReadRows: number[][]` (validated, positional to line items) on to
`decideExpenseDraft`; until Phase 4 it is accepted and ignored.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/components/forms/expense-form/expense-form-merge.test.tsx` — select 2 rows →
  „Połącz zaznaczone” → one row with the summed Kwota and both photos (a shared photo once); merged row
  shows „Rozłącz”, not „Odczytaj ponownie”; blank-Kwota constituent → „nie odczytano”; „Rozłącz”
  restores the read rows; the save sends the union + read rows and no skipped receipt for merged-away
  paragony; trash on a merged row sends one skipped receipt per paragon
- `pnpm exec vitest run src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx`
- `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx`
  — a hint on a merged paragon follows the merged row; „Duplikat” on it fans out with `duplicateOf`
- `pnpm exec vitest run src/__tests__/components/forms/expense-form/use-invoice-files.test.ts` if it
  exists, else the setter is covered by the merge spec

#### Manual Verification:

- Zgłoszenie with several bileciki on 3 photos → „Przyjmij”: tick the bileciki rows, „Połącz
  zaznaczone”: one row, Kwota = their sum, all 3 photos once each; „Zapisz” books ONE transakcja; the
  worker's history shows it as one „Przyjęte” row with all photos.
- Same zgłoszenie, merge then „Rozłącz”: the original rows come back with their own amounts and photos.
- Merge two rows, delete the merged row, save the rest: the worker's history lists each merged-away
  paragon as „odrzucony”, and „Przywróć” on one brings back that paragon alone.
- „Nowy wydatek” (management): no checkboxes, „Odczytaj ponownie” works as before.

---

## Phase 4: Booked paragony stay visible to the duplicate check

### Overview

The link stores which read rows a transakcja was booked from; the duplicate check probes those
paragony individually.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next>_add_draft_transfer_read_rows.ts` (hand-written; copy the latest file's
shape, register in `index.ts`; `git status src/migrations` first)

**Intent**: `ALTER TABLE worker_expense_draft_transfers ADD COLUMN read_rows integer[]` — nullable,
old links stay null.

#### 2. Decide

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: `decideExpenseDraft` writes `read_rows` per link, keeping only indexes that exist in the
draft's `ai_read.rows` (the same distrust `ownPages` applies to media ids).

**Contract**: `transferReadRows?: number[][]`, positional to `transferIds`.

#### 3. Candidates

**File**: `src/lib/db/expense-duplicate-candidates.ts`

**Intent**: `loadTransactionCandidates` also yields one candidate per read row of a link with
`cardinality(read_rows) > 1`, carrying that paragon's amount / number / NIP / date and pointing at the
transakcja (unique `key` per transakcja × read row). A single-paragon link keeps today's behaviour
(the transakcja's own fields).

### Success Criteria:

#### Automated Verification:

- Migration applies on the local DB and on 5435: `pnpm payload migrate` (after `git status src/migrations`)
- `pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts` — a merged booking
  stores its read rows; an out-of-range read row is dropped
- `pnpm exec vitest run src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts` — a paragon of a
  merged, booked transakcja matches a new draft's identical paragon and points at that transakcja
- `pnpm exec vitest run src/__tests__/lib/actions/worker-expense-drafts.db.test.ts`

#### Manual Verification:

- Book bileciki merged into one transakcja, then send one of those bileciki again as a new zgłoszenie:
  its „Przyjmij” shows a duplicate hint pointing at the merged transakcja.

---

## Phase 5: Docs

### Overview

The owner's definition of done: the change ships documented.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: A risk row for merge/split (a paragon lost or double-booked across merge → split → remove;
covered by the receipt-decision invariant spec); the multi-page-invoice-subtotal risk (accepted, no
fixture); refresh risk #24's text, which still describes mode-based grouping.

#### 2. Manual checks

**File**: `context/foundation/manual-checks.md`

**Intent**: Reword the one-expense-per-photo section (`:4821-4828`) that still describes the „Jeden
wydatek” confirm; `/10x-implement` adds this change's section from the phases' bullets.

#### 3. Living docs

**Intent**: Any doc under `context/foundation/` or `context/reference/` describing „Jeden wydatek” as
a worker choice or a single-document read is corrected (grep `Jeden wydatek`).

### Success Criteria:

#### Automated Verification:

- None — prose only.

#### Manual Verification:

- `grep -rn "Jeden wydatek" context/foundation context/reference` names only the management form.

---

## Testing Strategy

### Unit Tests:

- Merge arithmetic in grosze and the text-field rules; prefill shapes (new read, old single-row read,
  no read, uncovered photo); the decision invariant: every read row booked or skipped.

### Integration Tests:

- Per-photo read for a multi-photo `one-invoice` draft; `read_rows` stored and range-checked; duplicate
  candidates from a merged booking.

### Manual Testing Steps:

1. Prod-shaped zgłoszenie with bileciki on several photos: merge, save, check the worker's history.
2. Merge → „Rozłącz” → save separately.
3. Remove a merged row; „Przywróć” one of its paragony.
4. Resend a booked bilecik; see the duplicate hint.

## Migration Notes

Additive column, nullable; no backfill — a link from before this change keeps today's duplicate
behaviour. A human runs `pnpm db:migrate:prod` before pushing; preview needs `pnpm db:migrate:preview`
after the merge to staging.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`

## References

- Research: `context/changes/2026-10-12-worker-draft-merge-receipts/research.md`
- Prior change: `context/changes/2026-10-12-worker-draft-one-expense-per-photo/review-gate.md`
- Per-paragon arrays: `98ee7f439`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Always read per photo; prefill from the read; merge/split core

#### Automated

- [x] 1.1 merge-receipts unit spec — 1b9ad3d3f
- [x] 1.2 draft-prefill spec — 1b9ad3d3f
- [x] 1.3 receipt-decision spec incl. the booked-or-skipped invariant — 1b9ad3d3f
- [x] 1.4 read-expense-draft-receipts DB spec — 1b9ad3d3f

### Phase 2: Worker's dialog without „Jeden wydatek”

#### Automated

- [x] 2.1 dialog spec: no mode control, sends one-per-photo — 6312da194
- [x] 2.2 dialog language spec — 6312da194
- [x] 2.3 worker actions DB spec: stored scan_mode — 6312da194

### Phase 3: „Połącz” / „Rozłącz” in the „Przyjmij” dialog

#### Automated

- [x] 3.1 expense-form-merge DOM spec — 932402b32
- [x] 3.2 expense-form-prefill spec — 932402b32
- [x] 3.3 duplicate-mark spec on merged rows — 932402b32
- [x] 3.4 file-map setter covered — 932402b32

### Phase 4: Booked paragony stay visible to the duplicate check

#### Automated

- [x] 4.1 migration applies locally and on 5435 — 182fabd4d
- [x] 4.2 worker-expense-drafts DB spec: read_rows stored and range-checked — 182fabd4d
- [x] 4.3 expense-duplicate-candidates DB spec: merged booking candidate — 182fabd4d
- [x] 4.4 worker-expense-drafts actions DB spec — 182fabd4d

### Phase 5: Docs

#### Automated

- [x] 5.1 none — prose only
