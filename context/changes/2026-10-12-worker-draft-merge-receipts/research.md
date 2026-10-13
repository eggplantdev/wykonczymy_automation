---
date: 2026-10-12T21:21:13+02:00
researcher: Claude
git_commit: f97f695bc
branch: staging
repository: wykonczymy
topic: '„Połącz” / „Rozłącz” paragon rows in the worker zgłoszenie „Przyjmij” dialog; always read paragon by paragon'
tags: [research, worker-expenses, expense-drafts, receipt-scan, duplicate-detection, expense-form]
status: complete
last_updated: 2026-10-12
last_updated_by: Claude
---

# Research: merge / split paragon rows when accepting a worker's expense draft

**Date**: 2026-10-12T21:21:13+02:00 · **Git Commit**: f97f695bc · **Branch**: staging · **Linear**: EX-1048

## Research Question

How do we let a manager „Połącz” several AI-read paragon rows into one transakcja and „Rozłącz” them
back in the „Przyjmij” dialog? The goal is that a draft is always read paragon by paragon, and „Jeden
wydatek” only pre-merges in the prefill, with the sum computed in code. What does each layer assume
today, and what breaks?

## Summary

- **The booking side already supports a merge.** `worker_expense_draft_transfers` stores
  `(transfer_id, draft_id, media_ids)` with no `read_row`, so one transakcja covering several paragony
  is storable today. Its `media_ids` is the union of the pages.
- **The client assumes one line item = one read row.** Four places depend on it:
  - the prefill's group match;
  - `DraftReceiptT.readRow` (a single int);
  - the duplicate-hint lookup;
  - the per-line-item file map.
- **The core change** is `DraftReceiptT` → `{ mediaIds, readRows: number[] }`. A removed merged row
  then fans out into **one skipped receipt per constituent read row**. This keeps the DB schema and
  `restoreSkippedReceipt` unchanged, and the worker sees one „odrzucony” per paragon.
- **Dropping the single-document read is required, and it breaks the one-invoice prefill unless the
  prefill changes in the same step.** The prefill matches a group of ALL pages against read rows with
  ordered `sameItems`, so per-photo rows never match and the dialog would open one blank row.
  - „Jeden wydatek” must become "merge every read row".
  - The prefill must still accept the old stored shape: one row covering all pages (#13, #21 locally).
- **„Generuj” in the management form is untouched.** `extractReceipts` is used only by the draft path;
  `extractReceipt` / `scanReceiptPages` stay for `/api/extract-receipt`.
- **The main open correctness risk is unmeasured.** A real multi-page invoice read per photo may report
  a running subtotal on page 1 („do przeniesienia”), and a code-side sum would double-count it.
  - In practice: 0 multi-page invoices were ever photographed as separate photos (prior change's data).
  - There is no fixture for it.

## Detailed Findings

### 1. AI read path

- `src/lib/actions/read-expense-draft-receipts.ts:70-78` has the branch to drop: `isInvoice`
  (`one-invoice` && >1 page) → `readInvoice` → `scanReceiptPages` → `extractReceipt` gives one row
  for all pages.
  - The `MAX_RECEIPT_PAGES` early return (`:72`) guards only that branch and goes with it.
  - Otherwise each photo goes `readPhoto` (`:43-50`) → `scanReceiptList` → `extractReceipts`.
- Measured on #13's 3 ticket photos, `extractReceipt` over many documents returned 257.50 / null /
  286.90 zł against a true 287.90 zł. Per-photo `extractReceipts` plus a code-side sum is exact.
- What a page with no total (invoice page 2) gives: the `extractReceipts` prompt
  (`src/lib/ai/openrouter.ts:168-185`) says skip a document whose total is not legible and return an
  empty list if nothing is legible.
  - An empty list becomes an `UNREADABLE_RECEIPT` row (`read-expense-draft-receipts.ts:48`).
  - Alternatively the model returns an entry with `amount: null`.
  - A failed call gives a bare `{ mediaIds }` row (`:85`).
- Row order: pages follow `dm.position` (`src/lib/db/worker-expense-drafts.ts:62`) and
  `mapWithConcurrency` keeps input order. Within one photo the order is the model's, so it can vary
  between runs.
- Other callers of the single-document read: `scanReceipt` (`src/lib/ai/scan-receipt.ts:15-36`) ←
  `/api/extract-receipt` ← `use-receipt-generation.ts:98`, i.e. the management form's „Generuj” and the
  draft dialog's „Odczytaj ponownie”.
- Shared labels: the management form reads the `expenseDrafts.scanMode*` strings too
  (`line-items-field.tsx:59-65`). Rewording „Jeden wydatek” or its hint (`pl.ts:180-188`, which
  promises „jedna pozycja z kilkoma stronami”) changes that form as well.
- Worker dialog (`src/components/worker-expenses/expense-draft-dialog.tsx`):
  - toggle shown at ≥2 files (`:78`);
  - „Jeden wydatek” behind a confirm (`:206-226`) whose text warns that separate paragony are summed;
  - default `one-per-photo` (`:33`).
- `scan_mode` is a varchar with a CHECK constraint, default `'one-invoice'`
  (`20261006_1_add_worker_expense_draft_read.ts:10-15`). It is written at `worker-expense-drafts.ts:164`,
  read at `:84/:217/:456` and copied on restore at `:424-428`. No schema change is needed for this
  change.

### 2. Prefill and the „Przyjmij” dialog

- Grouping in `src/components/worker-expenses/draft-prefill.ts`:
  - `:31-35`: one group per page for one-per-photo, otherwise one group of all pages.
  - `:40-41`: read rows are matched with `sameItems` (`src/lib/utils/same-items.ts:1-2`), which is
    **ordered** array equality, not set equality.
  - `:44-48`: each matched read row becomes one line item, and its pages are renamed with its `filename`.
- `:53-61` builds `rowFiles` (by row position) and `receipts`: `Map<lineItemId, { mediaIds, readRow? }>`.
- Pages are downloaded as `File`s and **re-uploaded on save**
  (`use-expense-draft-acceptance.tsx:43-51`, `:89-91`). A `File` keeps no media id.
- Two paragony on one photo give two rows, each holding its own renamed copy of the same `File`. A
  naive merge would upload that photo twice, so the merged row must rebuild its pages from the
  **de-duplicated union of mediaIds** against `draft.media`.
- Submit: `expense-form.tsx:263-272` → `createBulkTransferAction(data, invoicePageRows, { expenseDraftId,
...receiptDecision(receipts, lineItems, duplicateOfByItemId) })`.

### 3. ExpenseForm line-item model

- A line item is flat strings: `id`, description, amount, netAmount, invoiceNote, documentNumber,
  sellerNip, documentDate, category, expenseCategory, worker. See `bulk-expense-form.ts:14-28`, with
  `makeLineItem` at `:35-50`.
- Files live outside the form in a map keyed by line-item id (`use-invoice-files.ts:19-26`):
  - `handleRemoveLineItem` (`:36-39`) drops a row's files, then the row.
  - `removeFileAt` (`:84-94`) removes one page.
  - `registerFilesAt` (`:65-82`) appends via ingest.
  - `positionalFiles` (`row-file-positions.ts:8-18`) maps files to positions at submit.
  - **There is no "replace this row's files" setter.** Merge and split need one.
- **There is no per-row selection or row-action UI.**
  - Each row has its index label (`line-items-field.tsx:273-277`), a trash `RemoveButton` (`:346-364`)
    and „Odczytaj ponownie” (`:383-394`).
  - Extension points: `renderAboveLineItems` and `onRemoveLastItem` props (`expense-form.tsx:98-104`,
    rendered at `:436-439`), plus `markDuplicate` (`:318-327`).
  - A „Połącz” toolbar fits in `renderAboveLineItems`. Per-row checkboxes and a „Rozłącz” control need
    new `LineItemsField` props.

### 4. Server: decide, skip, restore

- `createBulkTransferAction` (`src/lib/actions/transfers.ts:113-207`):
  - validates `skippedReceipts` with `skippedReceiptSchema` (`:131-135`);
  - creates N transakcje and calls `decideExpenseDraft` in one transaction (`:189-198`).
- `decideExpenseDraft` (`src/lib/db/worker-expense-drafts.ts:342-389`):
  - writes transfer links `(transfer_id, draft_id, media_ids)`, position-aligned;
  - writes skipped receipts `(media_ids, read_row, duplicate_of)` (`:380-385`);
  - only checks `ownPages` (`:365-368`), i.e. that media ids belong to the draft;
  - **never checks `read_row` against `ai_read`, and nothing asserts that every read row was booked or
    skipped.** A merge bug could silently drop a paragon; a spec must guard that invariant.
- `restoreSkippedReceipt` (`:413-446`) copies `ai_read->'rows'->read_row` only when its `mediaIds`
  equal `sr.media_ids` as a set, else it restores an empty read (`:429-433`).
  - A merged skip written as ONE row (union of pages, one `read_row`) would restore blank.
  - **N rows, one per constituent, restore correctly as they are.**
- Worker history: `PARAGON_ROWS` (`:191-210`) gives one row per transfer link and one per skipped
  receipt, with pages filtered by `media_ids` (`:224`). `TransferCell`
  (`tables/expense-drafts.tsx:32-51`) assumes one transakcja per row.
  - A merged transakcja renders as one „Przyjęte” row with the sum and all its photos. That is correct
    with no change.

### 5. Duplicate detection

- Detection is **per AI read row**, not per line item:
  - `loadDraftProbes` lists `ai_read.rows` with `readRow` = position
    (`src/lib/expense-duplicates/expense-duplicate-candidates.ts:51-63`).
  - Pending-draft candidates are per read row (`:101-142`).
  - Booked-transakcja candidates come from their own amount / `document_number` / note line 1 (`:66-98`).
- Rules (`match.ts:88-131`):
  - same number only counts with agreeing amounts (`:96`, `:102-106`);
  - same paragon = same amount + day + seller (`:115-122`);
  - same amount alone counts within 3 months (`:125-130`).
- Hints reach a line item through `receipts.find(r => r.readRow === paragon.readRow)`
  (`use-expense-draft-acceptance.tsx:132-136`).
  - With `readRows[]`, every constituent's hint points at the merged item.
  - „Duplikat” (`expense-draft-duplicate-hints.tsx:96-98`) marks the whole item. To mark one
    constituent, the manager must „Rozłącz” first.
- **The gap after booking:** a merged transakcja stores the sum and at most one number, so a constituent
  paragon sent again later matches no rule.
  - Fix with no schema change: `loadTransactionCandidates` also expands the read rows of accepted
    drafts, joined via `worker_expense_draft_transfers` (already joined at `:78-79`), as candidates
    pointing at that transakcja.
  - Pending-draft candidates are unaffected, because `ai_read` keeps the per-paragon rows.

### 6. Data (local 5433, a prod dump; ids differ from prod)

- 20 drafts, sent 2026-10-06 to 2026-10-12.
- `one-invoice`: 13 with 1 page, 1 with 2 pages, 1 with 7 pages. `one-per-photo`: 2 pages ×3, 7 pages ×1.
- Two pending `one-invoice` multi-page drafts still hold the old single-row read:
  - #13: 7 photos, one 1058.05 zł row;
  - #21: 2 PNG screenshots, one `UNREADABLE` row.
  - Local #22 = prod #24, the paragon-by-paragon re-read: 37 rows, 1177.85 zł.

## Code References

- `src/lib/actions/read-expense-draft-receipts.ts:70-78`: the single-document branch to remove
- `src/lib/ai/openrouter.ts:139-158` / `:164-194`: `extractReceipt` vs `extractReceipts` prompts
- `src/components/worker-expenses/draft-prefill.ts:31-61`: grouping, `sameItems` match, `receipts` map
- `src/components/worker-expenses/use-expense-draft-acceptance.tsx:43-51,89-91,132-136`: page download, re-upload, hint lookup
- `src/lib/worker-expenses/receipt-decision.ts:5`, `src/lib/expense-duplicates/duplicate-of.ts:13-17`: `DraftReceiptT` / `skippedReceiptSchema`
- `src/components/forms/expense-form/use-invoice-files.ts:19-94`: per-row file map
- `src/components/forms/expense-form/line-items-field.tsx:273-394`: row chrome (label, remove, re-read)
- `src/lib/db/worker-expense-drafts.ts:342-389,413-446,191-224`: decide, restore, history rows
- `src/lib/expense-duplicates/expense-duplicate-candidates.ts:51-142`, `match.ts:88-131`: duplicate probes and rules
- `src/__tests__/fixtures/receipt-photos.ts:28-50`: #13 ticket photos already in the live eval

## Architecture Insights

- **Fan-out at the decision boundary** keeps the persistence model per paragon while the UI groups.
  - A merged line item is a view-level aggregate of N read rows.
  - Booking stores it as one transakcja; skipping stores N paragon records.
  - This is a Composite-like grouping that never persists as a group.
  - The DB keeps one fact per paragon. Restore, history and duplicates keep their unit of identity.
- **Derive, don't store, the merged figures.** amount and netAmount are summed in grosze from the
  constituents' read rows. „Rozłącz” rebuilds rows from `draft.aiRead.rows[readRows]`.
  - The read is immutable (first-writer-wins), so the split is always exact.
  - The cost: manual edits on a merged row are lost on split.
- **Merge rules for text fields:**
  - description, date and NIP come from the first readable constituent, never the `UNREADABLE` sentinel;
  - `invoiceNote` is concatenated;
  - `documentNumber` is de-duplicated (an invoice repeats it per page) and blank when the numbers differ;
  - netAmount is blank unless every constituent has one;
  - a constituent with no amount makes the merged amount **blank or flagged, never a silently partial
    sum**.

## Historical Context (from prior changes)

- `context/changes/2026-10-12-worker-draft-one-expense-per-photo/` (in-review):
  - one-per-photo became the default and „Jeden wydatek” moved behind a confirm, because „0 multi-page
    invoices ever photographed as separate images”;
  - first-writer-wins `saveExpenseDraftRead`;
  - a restored skipped paragon with no read row gets an empty row and is not re-read;
  - skipped: deriving `mediaIds` server-side from `readRow`, and uploading a shared photo once.
- `context/archive/2026-10-05-worker-expenses/` (EX-971): a draft accepted as several lines tags only
  the first expense (a known limit). Merging reduces how often it applies.
- `context/archive/2026-10-06-worker-expense-ai-prefill/` (EX-1001): the read happens at send in
  `after()`, is stored on the draft and prefills the dialog.
- `context/archive/2026-10-06-skipped-receipt-restore/` (EX-1009): a restored paragon becomes a new
  pending zgłoszenie and leaves the parent's history; the list shows one row per paragon.
- `context/archive/2026-10-07-invoice-duplicate-detection/` (EX-1025): „Duplikat” is per paragon, a
  third exit beside akceptuj/pomiń. Never write a skipped receipt under a pending draft.
- `context/foundation/lessons.md` (~l.2563) „A page a second draft needs is shared, never moved”: it
  applies to any path that moves, splits, restores or refuses draft pages. A media row is never
  deleted while a `media_ids` array names it.
- `context/foundation/test-plan.md`:
  - risk #24 (prefill from photos the draft no longer holds) has stale text;
  - risk #26 (double booking / lost „Duplikat”) covers the duplicate side;
  - there is no risk row for merge/split yet.
- `context/foundation/manual-checks.md:4821-4828`: the one-expense-per-photo checks (confirm text, a
  restore giving one empty row) need rewording for pre-merge.

## Related Research

- `context/archive/2026-10-07-invoice-duplicate-detection/`
- `context/archive/2026-10-06-worker-expense-ai-prefill/`

## Open Questions

1. **Multi-page invoice subtotal.** Does a per-photo read of a real 2–3 page invoice report the page-1
   running subtotal as `amount`?
   - Needs a fixture in `receipt-photos.ts` and a live eval asserting that Σ per-page amounts = the total.
   - If it fails, „Jeden wydatek” pre-merge must take the LAST page's amount instead of the sum. That is
     an owner decision.
2. **Merged amount with an unreadable constituent:** blank, or partial sum plus a warning? (The
   recommendation is blank or flagged.)
3. **„Odczytaj ponownie” on a merged row** sends all its pages to `extractReceipt`, which is the
   unreliable behaviour. Options: hide it on merged rows, or re-read per constituent and re-sum.
4. **Old stored reads** (#13, #21: one row covering all pages) need a prefill path that maps them to one
   line item with `readRows: [0]`. Alternatively re-read them, but first-writer-wins forbids replacing
   a stored read.
5. **Duplicate coverage after booking:** expand the read rows of accepted drafts in
   `loadTransactionCandidates` in this change, or file it separately?
6. **Copy:** the „Jeden wydatek” label, hint and confirm text, shared with the management form
   (`pl.ts:180-188`). Reword for the draft only, or both?
