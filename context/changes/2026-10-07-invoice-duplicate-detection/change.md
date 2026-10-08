---
change_id: invoice-duplicate-detection
title: Wykrywanie duplikatów faktur/paragonów przy akceptacji zgłoszeń wydatków
status: preparing
created: 2026-10-07
updated: 2026-10-08
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: **EX-1025** (this change). Follow-up: **EX-1026**, the audit: a button that scans already-booked
transakcje in a date range for duplicates. It reuses this change's matching rules and is built after
this one ships.

### Goal

Catch duplicate wydatki. Catching a worker who submits them on purpose is a side effect, not the aim:
no per-worker tally, no tracking of individuals (owner, 2026-10-07).

Duplicate sources (owner, 2026-10-07):

- two workers send the same invoice,
- one worker uploads the same photo several times,
- one worker uploads a different photo of the same invoice/paragon.

### How the flow works today (the reason the design looks like this)

A worker never books a transakcja directly. He sends a zgłoszenie (`sendExpenseDraftAction`: photos +
investment + kasa). The AI reads it in `after()`, so by then the worker has already left the screen.
Management accepts it into transakcje through a prefilled `ExpenseForm` (`use-expense-draft-acceptance.tsx`),
rejects it, or skips single paragony (`worker_expense_draft_skipped_receipts`). The review queue at
`/zgloszenia-wydatkow` is already the human check.

### Rulings (owner, 2026-10-07)

- **The hint appears in exactly two places:** the accept dialog of a zgłoszenie (this change) and the audit
  (EX-1026). It does NOT appear as a badge on the queue list, in management's own expense form, or as a
  „do sprawdzenia" view/flag on transakcje. A wydatek management books by hand is covered by the audit.
- **The worker never sees anything,** on any surface: the send flow, his zgłoszenia list, his own
  `/pracownicy/[id]`. A worker who is told learns to dodge the check.

### Direction

- Dedicated fields for document number + seller NIP, filled by the existing AI receipt scan and editable.
  Today the number lands on line 1 of free-text `invoiceNote` (`src/lib/utils/invoice-note.ts`). Never
  forced as manual input. Must be persisted on the booked transakcja, because both later zgłoszenia
  and the audit compare against it.
- Content hash of each uploaded page, for the identical-file case.
- Strong match: same NIP + number, or same file. **Not** scoped to the same investment/kasa, because a
  deliberate duplicate gets re-sent under a different one. A fresh photo defeats the hash, so the
  NIP + number match is the load-bearing signal.
- Weak match: same amount within a few days, with no number to compare.
- Compare against booked transakcje **and** other pending zgłoszenia (two workers, both in the queue).
- In the accept dialog: a per-paragon hint naming the match (date, amount, who sent each side, link).
  Management decides; the existing „pomiń paragon" is the exit. The hint never blocks: management is the
  decision-maker, and an AI misread must not stop a legitimate wydatek.

### Evidence from the local DB (restored prod dump, 2026-10-07)

Booked `INVESTMENT_EXPENSE`, not cancelled; „number" = line 1 of `invoice_note`.

- **Same number + same amount: 5 pairs, all probable real duplicates.** Transakcje 4305/4306 (same day,
  same investment), 5197/5262 (different kasy), 3899/4454 (a month apart), 4884/5701 and 5697/5720
  (**different investments**; 5720 booked by a different person). Same number with a different amount is
  not a duplicate: `1111116864781` across three amounts is a loyalty-card-like number, and `2/10/2026` is
  a date. So a number match counts only together with the amount.
- **The AI reads a different number off the same paragon.** Zgłoszenia 3 and 4 hold the same Castorama
  paragon (107,40 zł, 06.10.2026, identical items), read as `087393/0888` vs `812765/003957/26`. A
  paragon prints several numbers. A number-only match misses this case; amount + receipt date
  (from `description`, the date printed on the document) + seller + overlapping items catches it.
- **Amount alone is noise:** 618 pairs with an equal amount booked within ±3 days. Amount + the
  _receipt_ date (not the booking date) leaves 2 pairs, both with distinct numbers, so they look
  legitimate. The usable weak signal is keyed on the receipt date.
- **The same file reads differently.** Media 2127 (zgłoszenie 3, worker 69) and 2129 (zgłoszenie 4,
  worker 32) are byte-for-byte the same photo (equal size + dimensions), as are 2126/2130: one worker
  forwarded the photos to the other. From the identical 107,40 zł file the AI read `087393/0888` once
  and `812765/003957/26` once, so AI reads are not deterministic. A file match catches what a number
  match misses.
- **Same file + different amount = a legitimate split.** One invoice divided across investments
  carries the same photo on each transakcja (3338/3339/3807, 2549/2550). Same file + same amount =
  duplicate (5197/5262, 2986/2988, 3612/4014, 4305/4306). So a file match also counts only together
  with the amount.
- **Scope is not only `INVESTMENT_EXPENSE`.** Orlen 614,42 zł was booked 3× as `OTHER` from one file
  (5748/5750/5752); management caught it by hand and cancelled two. Candidate types:
  `INVESTMENT_EXPENSE`, `INVESTMENT_EXPENSE_NET`, `OTHER`.
- The spike fingerprints a file by `filesize + width + height`, because `media` has no content hash.
  The real build needs a sha256 column filled at upload.

### Open

Both settled by the spike outcome below: a table row with a photo preview; a strong match in red, a
weak one muted.

### „Duplikat" marking (owner, 2026-10-07)

Working assumption: nobody is cheating.

- Management sets it **manually after verifying**. The system never sets it from a match.
- It applies **per paragon** (the would-be transakcja), not per zgłoszenie. One zgłoszenie can hold
  several paragony, and only one of them may be the duplicate. It is a third way out for a paragon,
  next to „akceptuj" and „pomiń", and naturally extends the existing skipped-paragon record with a
  reason.
- **The worker sees it as „odrzucone"**; only management sees „duplikat". This keeps the „worker
  sees nothing" ruling. His statuses render on `/pracownicy/[id]` via `worker-expense-drafts-table.tsx`.

### Spike outcome (owner accepted, 2026-10-07)

The spike is uncommitted in the working tree; the change hardens what it built rather than redesigning it.

- **Hint = a Telmak-style table** (`src/components/tables/expense-duplicates.tsx`, same shape as
  `telmak-check.tsx`) above the form in the accept dialog, which is as wide as Telmak's
  (`sm:max-w-[96vw]`). The owner rejected a bespoke hint UI: reuse the existing table.
- **The check runs when the dialog opens**, once the AI read is in.
- **Per match row: „Duplikat" and „OK, to nie duplikat".** _(When the mark is saved is superseded by
  the 2026-10-08 ruling below.)_ „Duplikat" refuses on the click, recording
  which transakcja or zgłoszenie it repeats (`duplicate_of = {source, id}`). On the last paragon it
  rejects the whole zgłoszenie; otherwise it skips only that paragon, and the form reloads without it.
  „OK" only hides the row in the spike; nothing is stored yet.
- **The trash on the only line item works**, opening the reject confirm. It used to be disabled.
- **Management's queue** shows „Duplikat #id" beside „Odrzucone" and has a „Duplikaty" filter menu
  (the shared `FilterMultiSelect`, like „Anulowane" on transakcje). The worker still sees „Odrzucone".
- Seed for local testing: `spike-seed.sql` (local 5433 only).

### Research outcome (2026-10-08)

Full findings with file:line: `research.md`. What the plan has to carry:

- **Document identity fields.** The one receipt extractor (`src/lib/ai/openrouter.ts`, shared by the
  worker draft read and management's per-row scan) never asks for NIP; the number sits on `invoiceNote`
  line 1 and seller + printed date in `description`. Add `documentNumber` / `sellerNip` /
  `documentDate`: optional on the draft read (a read failing the schema loses the whole prefill),
  carried through the form, persisted as columns on `transactions`. `invoiceNote` and `description` stay —
  the sheet, the investor share view, Telmak and the filename read them. Sheet sync ignores the new columns.
- **Content hash in `/api/media-upload`.** Every app upload ≤ 4 MB reaches our server as bytes and is
  inserted by raw SQL (`insertMediaRow`, no Payload hook) — hash there. It catches a re-sent file from
  the same device and every PDF; a re-photographed or re-encoded receipt (another device/engine) has
  different bytes, so NIP + number + amount stays the load-bearing signal. The spike's fingerprint is
  already file-size-only for new uploads (raw-SQL rows have no width/height).
- **Candidate query rewrite.** The spike scans every receipt-type transakcja with a per-row fingerprint
  subquery and expands pending drafts with correlated `jsonb_array_elements` (the JIT trap). Target:
  `amount = ANY(…)`, file matches via `transactions_rels_media_id_idx` as a UNION, draft reads expanded
  once `WITH ORDINALITY`, `media.sha256` index.
- **Spike clean-up:** split the two-statement `lib/db` functions (orchestration → `lib/queries`);
  `findExpenseDraftDuplicates` returns `ActionResultT` like `queries/investment-asset-ids.ts`; dedup the
  skipped-media aggregate, the pages intersection and the media JSON; `who` → `submitterName`; strip
  `SPIKE` comments.
- **Dialog bugs:** „last paragon" decided from the prefill, not the live form; the remount drops the
  manager's edits; a failed AI read leaves „Sprawdzanie duplikatów…" forever; a reopen mid-read flashes
  „Nie znaleziono".
- **Tests:** `pending-expense-drafts.test.tsx:60-75` breaks (unmocked `findExpenseDraftDuplicates`,
  missing `markReceiptDuplicateAction`). Extend the draft db/action specs, the queue and worker table
  specs (worker never sees the label), new unit spec for `match.ts`. test-plan.md has no row for a
  double-booked receipt → add one with `/10x-test-plan`.
- Doc debt outside this change: `context/foundation/lessons.md:2127` still says uploads go straight
  to Blob; ≤ 4 MB now go through our server.

### Rulings (2026-10-08)

- **„Duplikat" is saved with the decision, not on the click.** The click takes the paragon out of the
  form and marks it; `duplicate_of` is written through `decideExpenseDraft`'s existing `skippedReceipts`
  when management accepts or rejects the zgłoszenie. On the last paragon the click still rejects the
  whole zgłoszenie at once. Why: refusing on the click puts a skipped paragon under a _pending_
  zgłoszenie, which nothing else expects — „Przywróć" shows but fails (`is_restorable` ignores the
  parent's status), the worker can remove the refused page and the reclaim deletes its blob
  (`findDraftHeldMedia` ignores skipped receipts), refused pages count toward the page cap and get
  re-read by the AI (paid again), deleting the pending zgłoszenie cascades the mark away, and the
  worker sees „Odrzucone" on a zgłoszenie that is still pending. Management's screen behaves the same.

### Open questions

1. Should „OK, to nie duplikat" persist, so a reopen and the EX-1026 audit don't re-flag the same
   pair — and where is it stored?
2. Hash for uploads > 4 MB (browser → Blob, server only `head()`s): full GET on register, a client-sent
   `crypto.subtle` hash, or skip (mostly large PDFs)?
3. Backfill for existing transakcje: hashes from `dumps/blob-mirror/` are cheap (applied to prod by a
   human); `documentNumber` can be seeded from `invoiceNote` line 1; NIP has no source short of
   re-reading every photo — do we backfill, and which fields?
4. `CORRECTION` carries invoices too, but its amount is negative so the amount-gated match never fires —
   in scope or not?
5. Must a duplicate mark outlive its zgłoszenie for EX-1026? The skipped-receipt FK cascades on delete.
   Under the ruling above a pending zgłoszenie holds no marks yet; check whether a decided one can still
   be deleted before deciding.
