# Skipped paragon — restore + per-paragon list rows (EX-1009) Implementation Plan

## Overview

When a manager accepts a zgłoszenie and drops one paragon from the form, that paragon is kept as a
skipped receipt and lists as an „odrzucony” row under the accepted zgłoszenie. This plan does two
things:

1. Makes that paragon restorable. It comes back as a new „czeka” zgłoszenie holding the paragon's
   pages.
2. Moves the paragon split from the client into SQL. Status filter, count, page size and status sort
   then all count the rows the table shows.

## Current State Analysis

- `listExpenseDraftHistory` (`src/lib/db/worker-expense-drafts.ts:252`) returns one row per
  zgłoszenie. The status filter (`queueFiltersWhere`), the count (`:266`) and the status sort (`:239`)
  all read `d.status`.
- `ExpenseDraftsDataTable` (`expense-drafts-data-table.tsx:66`) and `WorkerExpenseDraftsTable`
  (`worker-expense-drafts-table.tsx:63`) split those rows per paragon on the client with
  `splitByReceipt`. As a result:
  - „odrzucony” misses skipped paragony;
  - „przyjęty” shows rows badged „odrzucony”;
  - „N wyników” / „Pokaż N” count zgłoszenia, not rows;
  - the status sort puts skipped rows inside the „przyjęty” block.
- `splitByReceipt`'s `<= 1` shortcut (`split-by-receipt.ts:8`) ignores skipped receipts. An accepted
  draft whose transakcja was deleted therefore shows its one skipped paragon not at all, or shows only
  „odrzucony” rows when there are 2+.
- A skipped row gets no action (`expense-drafts-data-table.tsx:47`). `restoreRejectedExpenseDraft`
  (`:340`) only re-opens a wholly rejected draft.
- `worker_expense_draft_skipped_receipts` (`id serial`, `draft_id`, `media_ids int[]`) already exists
  (migration `20261006_3`). **No migration is needed.**

## Desired End State

- `/zgloszenia-wydatkow` lists one row per paragon from SQL:
  - „Status” = „odrzucony” shows rejected zgłoszenia plus every skipped paragon;
  - „przyjęty” shows only booked paragony;
  - „N wyników”, the page count and „Pokaż N” count those rows;
  - sorting by „Status” groups them by their own badge.
- A skipped paragon row has „Przywróć”. Clicking it:
  - creates a „czeka” zgłoszenie with the parent's pracownik, inwestycja, kasa, note, scan mode and
    **original send date**, holding the paragon's pages;
  - carries the parent's AI read of that paragon, so „Zweryfikuj” is prefilled at once; a fresh read
    runs only when the parent has none for it (the read failed or never landed);
  - deletes the skipped row, leaving no trace in the parent's history;
  - raises the badge by 1 on refresh.
- The restore is refused when a party is in the trash, and the row then shows no „Przywróć”. A
  second restore of the same paragon is also refused.
- The worker's own table reads the same SQL rows. `splitByReceipt` is gone.

### Key Discoveries:

- `worker_expense_draft_media` has PK `(draft_id, media_id)`, so a page can sit in two drafts.
  `findDraftHeldMedia` (`:520`) sees both, so deleting the restored draft never reclaims a page the
  accepted parent still shows.
- `sent_at` is `NOT NULL DEFAULT now()` (`20261005_3:15`), so the insert can set it explicitly.
- The parent's `ai_read` survives the acceptance. A decided draft is never written to, and
  `DRAFT_SELECT` (`:90`) only hides it. A paragon's pages are fixed by the mode (one page each in
  „Kilka wydatków”, all pages in „Jeden wydatek”), and the manager cannot regroup them
  (`draft-prefill.ts:29-40`). So a skipped receipt's `media_ids` equal exactly one read row's
  `mediaIds`, which is the same match `buildDraftPrefill` makes with `sameItems`.
- `readExpenseDraftReceipts` reads only pending drafts (`loadExpenseDraftForRead`, `:443`). Firing it
  via `after()` matches `sendExpenseDraftAction`; it is the fallback, not the default.
- `inList` (`sql-list.ts`) builds the status clause on any column. `queueFiltersWhere` gets
  `{ ...filters, statuses: null }` and stays untouched, which keeps the `worker-reports.ts` twin safe.
- `LISTED_DRAFT` must keep reading `d.status`. An accepted parent's skipped row must stay listed when
  its kasa or inwestycja is trashed.

## What We're NOT Doing

- No migration and no schema change.
- No change to the pending dashboard queue (`listPendingExpenseDrafts`). Pending drafts never split.
- No „przywrócony” marker in the parent's history (owner, 2026-10-06).
- No fresh AI call when the parent's read already covers the paragon.
- No change to the inwestycja filter. It still reads the zgłoszenie's inwestycja, not the transakcja's.
- No change to `worker-reports.ts` / `queueFiltersWhere`.

## Implementation Approach

1. Build the paragon split once, as a SQL CTE shared by the history and the worker list.
2. Map each row onto the existing `ExpenseDraftRowT`. Each row carries 0 or 1 transfer and its own
   pages. `skippedReceipts` / `isSkippedReceipt` are replaced by one `skippedReceipt` field, so the
   seven consumers keep their shape.
3. Restore is one unconditional-CTE statement in the style of `decideExpenseDraft`, so its refusal is
   race-safe.

## Critical Implementation Details

- **Row-count window before the status filter.** The rule "a zgłoszenie that lists as one row shows
  all its pages" (today's `<= 1` shortcut, minus its bug) needs the per-draft row count. Compute that
  count over the **unfiltered** paragon set. Otherwise filtering to „przyjęty” changes which pages a
  row shows.
- **A draft with no transfer still gets a draft-level row.** This covers pending, rejected, and
  accepted drafts whose transakcja was deleted. The skipped rows sit beside it. That is what closes the
  `<= 1` bug.
- **Restore checks `PARTIES_NOT_TRASHED` and `d.status = 'accepted'` in the DELETE itself.** A refused
  restore then leaves the skipped row in place, and two managers racing get exactly one new draft.

## Phase 1: Paragon rows from SQL

### Overview

Both history lists return one row per paragon from the database. The status filter, count and sort
work on that row. `splitByReceipt` is deleted.

### Changes Required:

#### 1. Paragon-row query

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Add a `PARAGON_ROWS` CTE plus a per-row select. Use them in `listExpenseDraftHistory` and
`listWorkerExpenseDrafts`. `DRAFT_SELECT` stays for the pending queue.

**Contract**:

- One row per booked transakcja: `row_status = d.status`, ordered by transfer id.
- One row per skipped receipt: `row_status = 'rejected'`, ordered by `sr.id`, after the transfers.
- One draft-level row for a draft with no transfer.
- `row_count` = `count(*) OVER (PARTITION BY draft_id)` over that unfiltered union.
- Per-row pages: all of the draft's pages when `row_count = 1` or the row's `media_ids` is empty;
  otherwise only those ids, kept in `dm.position` order.
- Per-row `transfers`: the one transakcja or `[]`, read off `transactions` as now.
- History:
  - `WHERE ${queueFiltersWhere('d', LISTED_DRAFT, { ...filters, statuses: null })} AND
${inList(sql\`r.row_status\`, filters.statuses)}`;
  - the count is the same CTE with the same WHERE;
  - the status sort expression reads `r.row_status`;
  - every ORDER BY ends `…, d.sent_at DESC, d.id DESC, r.kind, r.part`, so a zgłoszenie's rows stay
    together and in a stable order.
- Worker list: same rows, `WHERE d.worker_id = … AND LISTED_DRAFT`, ordered
  `d.sent_at DESC, d.id DESC, r.kind, r.part`.

```sql
WITH paragons AS (
  SELECT dt.draft_id, d.status AS row_status, dt.transfer_id, NULL::int AS receipt_id,
         dt.media_ids, 0 AS kind, dt.transfer_id AS part
    FROM worker_expense_draft_transfers dt JOIN worker_expense_drafts d ON d.id = dt.draft_id
  UNION ALL
  SELECT sr.draft_id, 'rejected', NULL, sr.id, sr.media_ids, 1, sr.id
    FROM worker_expense_draft_skipped_receipts sr
  UNION ALL
  SELECT d.id, d.status, NULL, NULL, '{}', 0, 0
    FROM worker_expense_drafts d
   WHERE NOT EXISTS (SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = d.id)
), rows AS (
  SELECT p.*, count(*) OVER (PARTITION BY p.draft_id) AS row_count FROM paragons p
)
```

#### 2. Row type

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Replace `skippedReceipts?: number[][]` and `isSkippedReceipt?: boolean` with one field
for the skipped-paragon row.

**Contract**: `skippedReceipt?: { id: number }`, set only on a skipped-receipt row; Phase 2 widens it
with `isRestorable`. `status` is the row's own status. `DRAFT_SKIPPED_RECEIPTS` is deleted.

#### 3. Tables drop the client split

**Files**:

- `src/components/worker-expenses/expense-drafts-data-table.tsx`
- `src/components/worker-expenses/worker-expense-drafts-table.tsx`
- `src/components/tables/expense-drafts.tsx`

**Intent**: Pass `data` / `drafts` straight through. Gate the skipped-row branch on
`draft.skippedReceipt` and update the `TransferCell` comment.

**Contract**: Same props; no `splitByReceipt` import.

#### 4. Delete the client splitter

**Files**:

- `src/lib/worker-expenses/split-by-receipt.ts`
- `src/__tests__/lib/worker-expenses/split-by-receipt.test.ts`

**Intent**: The rule now lives in SQL. Move its cases into the DB spec (below).

**Contract**: Gate the deletion on typecheck, not grep.

#### 5. DB regression guard

**File**: `src/__tests__/lib/db/worker-expense-drafts.db.test.ts` (`the draft history` block)

**Intent**: Pin the behaviour the client split got wrong, against the real query. Fixtures:

- an accepted draft with 2 transfers and 1 skipped receipt, each over its own pages;
- an accepted draft with 1 transfer;
- an accepted draft with 0 transfers and 1 skipped receipt;
- the existing pending and rejected ones.

**Contract**: Assertions:

- `statuses: ['rejected']` returns the rejected draft plus the skipped rows, each with only its own
  pages.
- `['accepted']` returns no skipped row.
- `totalDocs` counts rows.
- A one-transfer draft shows all its pages.
- The 0-transfer accepted draft lists one „przyjęty” row plus its skipped row.
- A status sort puts skipped rows in the „odrzucony” block.
- The worker list returns the same split.

### Success Criteria:

#### Automated Verification:

- History + worker-list DB spec passes:
  `pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts`
- Worker table DOM spec still passes:
  `pnpm exec vitest run src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`
- Columns DOM spec still passes:
  `pnpm exec vitest run src/__tests__/components/tables/expense-drafts.test.tsx`

#### Manual Verification:

- „Zgłoszenia wydatków” → „Status” only „odrzucony”: shows the skipped paragony of accepted
  zgłoszenia next to wholly rejected ones. Only „przyjęty”: no row badged „odrzucony”.
- „Pokaż 10” with a zgłoszenie of several paragony: exactly 10 rows on the page, and „N wyników”
  equals the total row count across pages.
- Sort by „Status”: every „odrzucony” row (skipped paragony included) sits in one block.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Restore a skipped paragon

### Overview

„Przywróć” on a skipped-paragon row turns it into a new pending zgłoszenie.

### Changes Required:

#### 1. Restore statement

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: `restoreSkippedReceipt(db, receiptId): Promise<{ draftId: number; hasRead: boolean } |
null>` returns the new draft, or `null` when refused.

**Contract**: One statement:

- `DELETE FROM worker_expense_draft_skipped_receipts sr USING worker_expense_drafts d WHERE sr.id = …
AND sr.draft_id = d.id AND d.status = 'accepted' AND cardinality(sr.media_ids) > 0 AND
${PARTIES_NOT_TRASHED}`, returning the parent's fields and `media_ids`;
- `INSERT` into `worker_expense_drafts` with the parent's `worker_id`, `investment_id`,
  `cash_register_id`, `note`, `scan_mode` and **`sent_at`**. `ai_read` = `{ rows: [r] }`, where `r`
  is the parent's read row whose `mediaIds` equal the paragon's `media_ids` as a set; `NULL` when
  there is no such row;
- `INSERT` into `worker_expense_draft_media`, the parent's rows for those `media_ids`, keeping their
  `position`.

#### 2. Restorable flag on the row

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: A skipped row whose parent has a trashed party must not offer „Przywróć” (lessons.md:2544:
the list never offers a restore it will refuse).

**Contract**: `skippedReceipt?: { id: number; isRestorable: boolean }`, where `isRestorable` =
`PARTIES_NOT_TRASHED` evaluated in the row select.

#### 3. Action

**File**: `src/lib/actions/worker-expense-drafts.ts`

**Intent**: `restoreSkippedReceiptAction(receiptId)`, a `protectedAction` like
`restoreExpenseDraftAction`. Only when `hasRead` is false does it schedule `after(() =>
readExpenseDraftReceipts(db, draftId))`.

**Contract**: `ActionResultT`. Refusal text: „Nie można przywrócić — paragon został już przywrócony
albo pracownik, inwestycja lub kasa są w koszu.”

#### 4. Button

**Files**:

- `src/components/worker-expenses/restore-expense-draft-button.tsx`
- `src/components/worker-expenses/expense-drafts-data-table.tsx`

**Intent**: Generalise the button over what it restores. A skipped row with `isRestorable` gets it
(toast „Paragon przywrócony”); a non-restorable skipped row gets nothing.

**Contract**: The button takes `restore: () => Promise<ActionResultT>` and `successMessage`. The
existing draft call site passes `restoreExpenseDraftAction(draftId)`.

#### 5. Regression guards

**Files**:

- `src/__tests__/lib/db/worker-expense-drafts.db.test.ts`
- `src/__tests__/components/worker-expenses/expense-drafts-data-table.test.tsx` (new, `dom` project,
  action mocked via `vi.mock`)

**Intent**: Pin the restore's persisted state, not its return value.

**Contract**:

- DB:
  - the new draft is pending, with the parent's worker / inwestycja / kasa / note / scan mode /
    `sent_at`;
  - „Kilka wydatków”: its `ai_read` holds only the paragon's own read row; `hasRead` is true;
  - a parent with no read row for the paragon: `ai_read` is `NULL` and `hasRead` is false;
  - its pages are the paragon's, in the parent's order;
  - the skipped row is gone and the parent is unchanged (status, transfers, pages);
  - a second restore returns `null`;
  - a trashed kasa returns `null`, leaves the row in place, and lists it with `isRestorable: false`;
  - deleting the restored draft leaves the pages held (`findDraftHeldMedia`).
- DOM:
  - a restorable skipped row shows „Przywróć” and calls the paragon action with its id;
  - a non-restorable one shows none;
  - a rejected zgłoszenie still calls the draft action.

#### 6. Manual-checks wording

**File**: `context/foundation/manual-checks.md` (EX-1005 section, line ~4199)

**Intent**: The EX-1005 check says the skipped row is „bez „Przywróć””, which is now false.

**Contract**: Reword that one bullet to „z „Przywróć””. Add the EX-1009 section from this plan's
manual bullets at the final phase.

### Success Criteria:

#### Automated Verification:

- Restore DB spec passes:
  `pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts`
- Data-table DOM spec passes:
  `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-drafts-data-table.test.tsx`

#### Manual Verification:

- Accepted zgłoszenie with a skipped paragon → „Przywróć” on the „odrzucony” row:
  - a „Czeka” zgłoszenie with that paragon's photo appears, with the original send date;
  - the „odrzucony” row is gone;
  - the menu badge grows by 1;
  - „Zweryfikuj” on it opens „Nowy wydatek” already prefilled with what the AI read off that
    paragon when the zgłoszenie was first sent; there is no wait for a new read.
- The worker sees the restored zgłoszenie as „czeka” on his page and can edit or delete it. After a
  delete, the accepted zgłoszenie still shows the photo on its „przyjęty” rows.
- A skipped paragon whose kasa is in the trash: the row is listed without „Przywróć”.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit / integration:

- The DB spec carries both phases. It asserts persisted rows and the listed shape against the 5435
  test DB.
- Fixtures are fabricated; no real PII.

### DOM:

- `ExpenseDraftsDataTable` (new spec) covers the action routing per row kind.

### Manual Testing Steps:

1. Accept a 3-paragon zgłoszenie dropping one, then filter by „odrzucony”: the skipped paragon is
   there.
2. „Przywróć” it: a new „Czeka” zgłoszenie appears at the original date, and the badge rises by 1.
3. Trash its kasa on a second such case: the skipped row loses „Przywróć”.

## Performance Considerations

The CTE unions every draft's paragons before filtering. The window function blocks predicate
push-down, which is fine at today's volume (hundreds of drafts). If it ever matters, scope `paragons`
to the drafts passing `queueFiltersWhere`.

## Migration Notes

None. The schema from `20261006_3` already holds everything.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-10-06-skipped-receipt-restore/research.md`
- Unconditional-CTE pattern: `src/lib/db/worker-expense-drafts.ts:297-337`
- Draft restore: `src/lib/db/worker-expense-drafts.ts:340`
- Shared filter helper: `src/lib/db/queue-filters-where.ts:7`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Paragon rows from SQL

#### Automated

- [x] 1.1 History + worker-list DB spec passes
- [x] 1.2 Worker table DOM spec still passes
- [x] 1.3 Columns DOM spec still passes

### Phase 2: Restore a skipped paragon

#### Automated

- [ ] 2.1 Restore DB spec passes
- [ ] 2.2 Data-table DOM spec passes
