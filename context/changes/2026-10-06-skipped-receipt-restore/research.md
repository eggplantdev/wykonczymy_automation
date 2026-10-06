---
date: 2026-10-06T19:03:55+0200
researcher: Claude
git_commit: 945cb61d
branch: staging
repository: wykonczymy
topic: 'EX-1009 — pominięty paragon: co znaczy „Przywróć” i jak filtr statusu ma go łapać na /zgloszenia-wydatkow'
tags: [research, worker-expense-drafts, skipped-receipts, queue-filters, pagination]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude
---

# Research: pominięty paragon — „Przywróć” + filtr statusu (EX-1009)

## Research Question

Owner ruling (2026-10-06): a skipped paragon must be restorable, and the „Status” filter on
„Zgłoszenia wydatków” must catch skipped paragony. How?

## Summary

- **Restore cannot re-open the accepted parent.** Every path through it breaks something that already
  stands. The workable meaning is: **a new „czeka” zgłoszenie that shares the skipped paragon's pages**.
  The parent's skipped-receipt row is removed in the same statement, and `PARTIES_NOT_TRASHED` is
  checked there too.
- **The filter mismatch is structural.** Status filter, count, status sort and page size all work per
  zgłoszenie (`d.status`). The manager table renders one row per paragon (`splitByReceipt` on the
  client). There are two fixes:
  - **A**: a server EXISTS clause plus a client row filter. Small, but the count, „N wyników”, page
    size and status sort stay per zgłoszenie.
  - **B**: one SQL row per paragon. Larger, but correct on every axis.

  The worker page is already correct, because it filters split rows client-side over the full list.

## Detailed Findings

### Restore semantics

**Re-opening the parent (flip the accepted draft back to pending) — rejected:**

- `buildDraftPrefill` builds from all of `draft.media`, so re-accepting would rebook pages already
  booked.
- `decideExpenseDraft` would insert duplicate link rows and skipped rows.
- A reject would badge already-booked transfers as rejected.
- The stale `ai_read` would resurface.
- The worker would regain edit/delete on a pending draft, and a delete cascades the transfer links.
- The parent's parties may already be in the trash.

The previous gate settled the rule this breaks: decided drafts are never written to, except
reject → restore (`restoreRejectedExpenseDraft`, `src/lib/db/worker-expense-drafts.ts:340`).

**Moving the pages to a new draft (deleting the parent's `draft_media` rows) — rejected:**

- The parent's history row would lose its pages.
- `worker_expense_draft_transfers.media_ids` and `…_skipped_receipts.media_ids` are `int[]` with no
  FK. A later delete of the new draft would let the media reclaim drop a file the parent's arrays
  still reference.

**Recommended: a new pending draft sharing the pages.**

- `worker_expense_draft_media` has PK `(draft_id, media_id)`, so one media in several drafts is
  already allowed.
- The insert copies `worker_id`, `investment_id`, `cash_register_id` and `scan_mode` from the parent,
  so the `created_by` check passes.
- One statement, mirroring `decideExpenseDraft`'s unconditional-CTE style (`:300-336`):
  - `DELETE … skipped_receipts WHERE id = $receiptId RETURNING draft_id, media_ids`;
  - join the parent with `PARTIES_NOT_TRASHED`;
  - `INSERT` the draft;
  - `INSERT` the `draft_media` rows from the deleted row's `media_ids`.

  A trashed party leaves nothing deleted, so the action refuses.

- `DRAFT_SKIPPED_RECEIPTS` (`:77`) must start carrying `sr.id`, so the row can name what it restores.
  `splitByReceipt` must then pass it through.
- Amount 0 is forbidden at acceptance. The restored paragon therefore goes through the normal pending
  review: the „Zweryfikuj” dialog, a fresh prefill and a fresh decision.
- A paragon is never both booked and skipped (fd9c9c9d). Restore keeps it that way: the skipped row
  goes and the pages enter a pending draft; nothing books until a fresh accept.

**Points to settle:**

- `sent_at` — the original, or `now()`:
  - The original keeps chronology, but the restored zgłoszenie lands at the bottom of the „czeka”
    block.
  - `now()` puts it on top, like today's reject → restore (which leaves `sent_at` and only resets
    `status` / `decided_*`, so it already keeps the original).
- The AI read is not copied by default:
  - In one-invoice mode the parent's `ai_read` covers all pages; it is keyed by the exact page list
    (`saveExpenseDraftRead`).
  - In one-per-photo mode a per-photo row can be copied when its page is in the subset; otherwise
    fire a fresh `after(readExpenseDraftReceipts)`, as send does. This is a plan decision, not an
    owner one.
- Edge case: in one-invoice mode a skipped receipt holds **all** pages, and the booked transfer has
  `media_ids = []`. Restore then creates a zgłoszenie with the same pages as the booked parent.
  Correct per the owner's ruling, but the manual check must cover it.
- What the parent's history shows afterwards: the skipped row disappears, or a „przywrócony” row links
  to the new zgłoszenie.
- Side effects:
  - Send triggers no e-mail, only the AI read.
  - Draft actions don't revalidate tags; the client calls `router.refresh()`.
  - The pending badge is computed in the layout, so it picks the new draft up on refresh.

### Status filter, count, pagination

- `queueFiltersWhere` (`src/lib/db/queue-filters-where.ts:7-21`) is shared with `listDecidableReports`
  (`worker-reports.ts:314`).
  - A custom status clause needs no helper change: pass `{ ...filters, statuses: null }` and put the
    status clause into `base`.
- `LISTED_DRAFT` (`:195`) must keep reading the draft's own `d.status`. Otherwise a skipped paragon of
  an accepted zgłoszenie would vanish when its kasa or inwestycja is trashed.
- Count (`:266`) and status sort (`:239`) are per draft. `QUEUE_ORDER` (`:231`) is fine either way,
  because a pending draft is never split.
- `listExpenseDraftFilterOptions` (`:272-291`) is unaffected; it doesn't depend on status.

**Option A** — server: `d.status IN (S) OR ('rejected' ∈ S AND d.status = 'accepted' AND EXISTS
skipped)`; client: filter split rows by `statuses`, passed from `page.tsx`.

- An accepted draft always has ≥1 transfer at acceptance (`lineItems.min(1)`), so `accepted` needs no
  EXISTS.
- Still wrong after A:
  - „N wyników”, `totalPages` and „Pokaż N” count zgłoszenia;
  - a page shows more than N rows;
  - the status sort puts skipped rows inside the „przyjęty” block.

**Option B** — a CTE with one row per paragon:

- the rows: transfers ∪ skipped (status `rejected`) ∪ drafts with neither;
- count, sort and filter all run on `r.row_status`;
- needs per-row variants of `DRAFT_MEDIA` / `DRAFT_TRANSFERS` (correlated on the row, not `d.id`);
- keeps „empty `media_ids` = all pages”;
- a separate `ExpenseDraftHistoryRowT` with a `rowKey` keeps the type churn on the manager table,
  since `ExpenseDraftRowT` has 7+ consumers.

The worker page can keep `splitByReceipt`. Moving it onto B as well would leave one splitting rule
instead of two, at the cost of a wider diff.

**Latent bug found** (`split-by-receipt.ts:8`): the `<= 1` shortcut ignores skipped rows. An accepted
draft whose transakcja was deleted (link `ON DELETE CASCADE`, reachable per
`expense-drafts.test.tsx:105`) behaves inconsistently:

- with 1 skipped paragon, it renders whole as „przyjęty” and the skip is invisible;
- with 2+ skipped paragony, it renders only „odrzucony” rows.

The shortcut needs `skipped.length === 0`. Under B this goes away.

## Code References

- `src/lib/db/worker-expense-drafts.ts:77` — `DRAFT_SKIPPED_RECEIPTS`; `json_agg(sr.media_ids)`, no id
- `src/lib/db/worker-expense-drafts.ts:153` — `insertWorkerExpenseDraft`, to mirror for the restore insert
- `src/lib/db/worker-expense-drafts.ts:195` — `LISTED_DRAFT`
- `src/lib/db/worker-expense-drafts.ts:231-269` — `QUEUE_ORDER`, sort, `listExpenseDraftHistory`
- `src/lib/db/worker-expense-drafts.ts:300-336` — `decideExpenseDraft`, the unconditional-CTE pattern
- `src/lib/db/worker-expense-drafts.ts:340` — `restoreRejectedExpenseDraft`
- `src/lib/db/queue-filters-where.ts:7-21` — the shared filter helper (twin caller `worker-reports.ts:314`)
- `src/lib/actions/worker-expense-drafts.ts:~114` — `restoreExpenseDraftAction`
- `src/components/worker-expenses/expense-drafts-data-table.tsx:46-51,66` — row actions; skipped rows → `null`
- `src/lib/worker-expenses/split-by-receipt.ts:8` — the `<= 1` shortcut
- `src/lib/utils/pagination.ts:23-47` — limits 10/20/50/100, `totalPages`
- `src/migrations/20261006_2_*` — link table, `ON DELETE CASCADE`, legacy backfill

## Historical Context

- `context/changes/2026-10-06-worker-expense-drafts-history/review-gate.md` — line 109 filed this as EX-1009
- `context/foundation/lessons.md:2544` and the archived drafts review-gate (line 39) — every
  restore checks `PARTIES_NOT_TRASHED` in the same statement, and the list hides un-restorable rows
- `context/foundation/manual-checks.md:4199` — „…bez „Przywróć”” must be reworded when this lands

## Tests

- No spec covers `ExpenseDraftsDataTable`, and no E2E touches `/zgloszenia-wydatkow`.
- `worker-expense-drafts.db.test.ts:249-425` has no skipped-receipt fixture and filters only by
  `pending`.

The regression guard belongs in:

- a DB spec: status filter plus a skipped-receipt fixture, and the restore statement with a trashed
  party;
- the `split-by-receipt` unit spec, for the `<= 1` case.

## Open Questions (owner)

1. A restored paragon: does it come back as a new zgłoszenie „czeka” on top of the queue (`now()`),
   or at its original send date?
2. What stays in the original zgłoszenie's history once a paragon is restored — nothing, or a
   „przywrócony” marker?
3. Filter: A (cheap, page counts stay per zgłoszenie) or B (one row per paragon everywhere)?
