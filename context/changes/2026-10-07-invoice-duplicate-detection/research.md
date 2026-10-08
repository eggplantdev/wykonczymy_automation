---
date: 2026-10-07T19:44:00+02:00
researcher: Claude (Opus 5.5)
git_commit: a452f4c2b3ffb14479a71b3df8a4491a43351b83
branch: staging
repository: wykonczymy
topic: 'Hardening the duplicate-invoice spike (EX-1025): document identity fields, content hash, lifecycle of the „Duplikat” mark'
tags: [research, codebase, worker-expense-drafts, receipt-extraction, media, duplicates]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: hardening the duplicate-invoice spike (EX-1025)

**Date**: 2026-10-07T19:44:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: a452f4c2b (spike uncommitted in the working tree)
**Branch**: staging
**Repository**: wykonczymy

## Research Question

The spike (see `change.md` → „Spike outcome”) is accepted. What does the real build have to touch to
(1) give each document a durable identity (number, seller NIP, printed date) filled by the AI and
persisted on the transakcja, (2) fingerprint files by content, and (3) make the „Duplikat” mark
survive every path a zgłoszenie and its pages can take?

## Summary

- **Document identity is a schema + prompt change, not plumbing.** One shared extractor serves both
  the worker draft read and management's per-row scan; it never asks for NIP, seller or the date as
  separate fields — they exist only inside free-text `invoiceNote` (line 1 = number) and `description`
  („Castorama 05.10.2026”). New fields are additive everywhere; `invoiceNote` and `description` stay as
  they are, because the sheet, the investor share view, Telmak and the filename read them.
- **Content hash belongs in `/api/media-upload`.** Since EX-1012/EX-1014 (2026-10-07) every app upload
  ≤ 4 MB reaches our server as bytes and is inserted by raw SQL (`insertMediaRow`) — Payload hooks never
  run for it. > 4 MB goes browser → Blob and is only `head()`-ed. Hash = of the stored (compressed)
  bytes. It catches the same file re-sent from one device and every PDF re-send; it does **not** catch
  the same receipt re-photographed or re-encoded on another device — NIP + number + amount stays the
  load-bearing signal (as `change.md` already says).
- **The spike's fingerprint is already degraded:** raw-SQL media rows have `width`/`height` NULL, so
  for every new upload and every PDF the fingerprint is file size alone.
- **The real design question is when the mark is written.** The spike refuses a paragon while its
  zgłoszenie is still _pending_ — the first time a skipped paragon exists under a non-accepted draft.
  That breaks restore, page removal + media reclaim, read/page counts and delete-cascade (details
  below). Writing `duplicate_of` through `decideExpenseDraft`'s existing `skippedReceipts` at accept /
  reject time removes that whole class of bugs.
- **The candidate query won't scale as written**: full scan of receipt-type transakcje with a
  correlated fingerprint subquery, and per-row `jsonb_array_elements` over pending drafts (the JIT
  trap from `lessons.md`).

## Detailed Findings

### 1. AI extraction and document identity fields

- One extractor: `extractReceipt` (`src/lib/ai/openrouter.ts:40-132`), one `generateObject` call to
  `google/gemini-3.1-flash-lite` (`:18`), schema `receiptExtractionSchema`
  (`src/lib/ai/receipt-extraction-schema.ts:11-17`) = `description`, `amount`, `netAmount`,
  `invoiceNote`, `otherCategoryName`. Wrapped by `scanReceiptPages` (`src/lib/ai/scan-receipt.ts:31-56`).
- The prompt places the number on `invoiceNote` line 1 (`openrouter.ts:66-69`) and seller + date in
  `description`, legal suffixes stripped (`:55-59`). **NIP is never requested.**
- Management path: `/api/extract-receipt` → `useReceiptGeneration` (`use-receipt-generation.ts:99-101`)
  → `applyReceiptToRow` → `receiptToLineItemValues` (`apply-receipt-to-row.ts:16-43`).
- Draft path: `readExpenseDraftReceipts` → `scanReceiptPages` (`read-expense-draft-receipts.ts:35`) →
  `toReadRow` (`:18-26`) → `ai_read`, validated by `expenseDraftReadSchema`
  (`expense-draft-read.ts:5-14`); prefill reuses `receiptToLineItemValues` (`draft-prefill.ts:44`).
- A stored `ai_read` is returned as-is (`read-expense-draft-receipts.ts:51`) and a read that fails the
  schema loses the prefill (`worker-expense-drafts.ts:119-122`) → **new read fields must be optional**.
- Line item → transakcja: `bulk-expense-form.ts:14-41` → client schema (`bulk-expense-schema.ts:22-34`,
  persisted for recovery, so `.catch('')`) → `mapLineItem` (`map-line-item.ts:28-48`) → server schema
  (`bulk-expense-schema.ts:110-120`) → `createBulkTransferAction` (`src/lib/actions/transfers.ts:133-150`,
  `invoiceNote` at `:148`).
- Files a persisted `documentNumber` / `sellerNip` / `documentDate` touches: `src/collections/transfers.ts`
  (next to `invoiceNote` `:243`) + `generate:types`; hand-written migration + index; extractor schema,
  prompt, NIP normalisation; draft read schema + `toReadRow`; `apply-receipt-to-row.ts`,
  `bulk-expense-form.ts`, `bulk-expense-schema.ts`, `map-line-item.ts`, `line-items-field.tsx`
  (Notatka at `:385`), `actions/transfers.ts`; edit path `lib/schemas/transfer.ts:51-65`,
  `lib/schemas/transfer-form.ts`, `edit-transfer-form.tsx`; matcher.
- **Sheet sync ignores new columns** — `tab-rows.ts` builds rows from a fixed field set (`:31-43`,
  `:62-71`, `:100-110`); the number already reaches the sheet inside `note`.
- `invoiceNote` other readers: transfers-table note popover (`tables/transfers.tsx:143-148`), investor
  share materials table line 1 (`materials-transactions-table.tsx:89-110`), sheet `note`, **Telmak** parses
  line 1 as the number (`db/telmak-check.ts:8`, `telmak/compare-telmak.ts:54`, `check-row.ts:25`) and the
  date out of `description` (`compare-telmak.ts:50`). → keep both; Telmak is a second consumer that can
  later move to the structured column.
- **No receipt-extraction eval harness exists** — the 2026-07-11 work only researched it; coverage is
  mocked-model specs (`__tests__/lib/ai/scan-receipt.test.ts`, `__tests__/receipt-extraction-schema.test.ts`).
  Existing transakcje have no NIP ground truth.
- Types: the spike compares `INVESTMENT_EXPENSE`, `INVESTMENT_EXPENSE_NET`, `OTHER`
  (`expense-duplicate-candidates.ts:10`). `invoice` has no type condition (`collections/transfers.ts:235-241`)
  and the expense form offers every `TRANSACTION_TRANSFER_TYPES` type (`constants/transfers.ts:315-325`).
  `CORRECTION` carries invoices too but is negative, so the amount-gated match never fires on it.

### 2. Media ingest and the content hash

- Every app upload ends in `uploadMediaBySize` (`src/lib/media/upload-ids.ts:52`), routed by size
  (`upload-media.ts:27-29`, cap 4 MB `constants/route-body.ts:6`):
  - **≤ 4 MB** → `/api/media-upload`: server holds the bytes (`route.ts:45`), `put()`s to Blob (`:73`),
    `insertMediaRow` raw SQL (`:58`).
  - **> 4 MB** → browser → Blob (`client-upload.ts:23`), then `/api/media-register` `head()` + 1 KB sniff
    (`media-register/route.ts:89,103-108`) → `insertMediaRow` (`:126`).
  - `insertMediaRow` (`src/lib/db/media.ts:20-28`) writes no width/height/thumbnail and runs no Payload hook.
- Compression: worker send, page append, ExpenseForm picks, edit transfer, invoice cell, Telmak use the
  `INVOICE` profile (CompressorJS canvas re-encode, q 0.6, edge 1920 — `compress-image.ts:15-18,33-37`).
  PDFs pass through untouched (`compress-image.ts:27-28`, `process-upload-file.ts:98`).
- **Accepting a draft re-uploads the draft's bytes uncompressed** (downloaded `use-expense-draft-acceptance.tsx`,
  renamed only `receipt-filename.ts:26-30`, re-uploaded `expense-form.tsx:237`) → the transakcja's media
  hash equals the draft's. Draft media rows stay (`actions/transfers.ts:155-163`). Not a problem while
  only _pending_ drafts are compared, but EX-1026's audit must not pair a transakcja with its own draft.
- Determinism: same input + same profile + same browser engine → very likely identical bytes; another
  device/engine (iOS Safari vs desktop Chrome, native HEIC vs `heic-to`) → different bytes.
- Hash sites: `/api/media-upload` (trustworthy, one line before `insertMediaRow`); `/api/media-register`
  needs a full GET of the blob (Simple Operation) or a client-sent `crypto.subtle` hash (forgeable, but a
  forgery only hides/creates an advisory hint). Payload `beforeChange` on `media` is useless for app uploads.
- `media` schema (`src/migrations/20260211_212425.ts:36-57`, later only `kind`
  `20260921_0_media_kind.ts:16`): no hash column. Dump 2026-10-07: 1960 rows, 884 PDF (width NULL),
  1060 JPEG, 16 PNG, ~285 MB.
- Backfill: `dumps/blob-mirror/` (3545 files, 389 MB, FTP mirror of production, filled by
  `scripts/blob-refresh-preview.sh`) can be hashed locally with zero Blob operations; producing an
  `id → sha256` file for a human to apply to prod. `blob-snapshot.mjs` is the fallback (plain `.env` =
  preview store).
- No hashing/dedup of uploads exists anywhere (only `leads/verify-signature.ts:19,28`).

### 3. Lifecycle of the „Duplikat” mark (spike behaviour)

Works: reject whole draft as duplicate (`worker-expense-drafts.ts:378`); restore rejected draft clears it
(`:423`); accept after an earlier refusal books the rest without the refused pages
(`use-expense-draft-acceptance.tsx:105`); restore of a skipped paragon under an accepted parent (`:443-445`).

Breaks because a skipped paragon now exists under a **pending** draft:

- **„Przywróć” shows but fails**: `is_restorable` (`:226`) ignores the parent's status; restore requires an
  accepted parent (`:445`) and reports „paragon został już przywrócony” (`actions/worker-expense-drafts.ts:166`).
- **Worker removes a refused page**: `removeExpenseDraftPage` (`:549-559`) unlinks it; the reclaim deletes
  the blob because `findDraftHeldMedia` (`:640-647`, `delete-unreferenced-media.ts:105`) only looks at
  draft pages, not skipped receipts → dangling `media_ids`, a restore creates a zero-page draft (`:461-466`).
- **Counts include refused pages**: last-photo guard (`:555`), page cap (`:655`), AI re-read
  (`loadExpenseDraftForRead` `:571`, paid again); switching to „Jeden wydatek” merges the refused page
  into the single read row and the hint flags the same match again.
- **Delete-cascade**: the skipped-receipt FK cascades (`20261006_3_…:13`) → a worker deleting his pending
  draft erases the mark the audit would want.
- `skipPendingReceiptAsDuplicate` (`:403-412`) accepts an empty page intersection and still succeeds.
- Dialog: „last paragon” is decided from the prefill, not the live form (`:175`); the `revision` remount
  (`:230`) drops the manager's edits; a failed AI read leaves „Sprawdzanie duplikatów…” forever
  (`:152-155`); a reopen mid-read briefly shows „Nie znaleziono”.

Worker visibility: `/pracownicy/[id]` renders `isManagerView: false` (`worker-expense-drafts-table.tsx:71`),
so the label never shows; a refused paragon shows as „Odrzucone” — **while the rest is still pending**
under the spike. No notification/e-mail fires on any reject; unread counts are management-only
(`unread-counts.ts:25`). Row JSON carries `duplicateOf` to the worker's client (owner-accepted, not a risk).

Cache: draft actions pass no tags; all draft reads are uncached and the client `router.refresh()`es.
`markReceiptDuplicateAction` matches that pattern.

### 4. Candidate query cost

- Transactions: `round(t.amount*100)::bigint IN (…)` (`expense-duplicate-candidates.ts:83`) can't use
  `idx_transactions_amount` (`20260915_0`), and is OR-ed with a per-row `EXISTS` building a `concat()`
  fingerprint over `media` (`:87-88`) → full scan of every receipt-type transakcja (~4.2k in the dump,
  growing with ~40 accounts) with a subquery per row. No date window.
- Pending drafts: `CROSS JOIN LATERAL jsonb_array_elements` plus two more correlated expansions
  (`:111`, `:119`) — the `lessons.md` „correlated `jsonb_array_elements` trips JIT” pattern; no amount
  pre-filter, every read row goes to JS.
- Cheaper shape: `t.amount = ANY($::numeric[])` (indexable); file matches through
  `transactions_rels_media_id_idx` as a UNION, not an OR; draft reads expanded once in a CTE
  `WITH ORDINALITY` with the amount filter in SQL; a `media.sha256` index replaces the fingerprint.

### 5. Tests

- Will break: `pending-expense-drafts.test.tsx:60-75` — the landed read now calls the stubbed
  `'use server'` `findExpenseDraftDuplicates` (throws); the actions mock (`:17`) lacks
  `markReceiptDuplicateAction`.
- Extend: `lib/db/worker-expense-drafts.db.test.ts` (history `:253-540`, skipped-receipt restore
  `:545-700`), `lib/actions/worker-expense-drafts.db.test.ts:167`,
  `lib/actions/worker-expense-drafts-worker.db.test.ts:341-375`, `components/tables/expense-drafts.test.tsx`,
  `worker-expense-drafts-table.test.tsx` (worker never sees the label), `expense-drafts-data-table.test.tsx:63-84`;
  new unit spec for `match.ts`. No E2E covers drafts.
- Test-plan anchors: #24 (prefill from pages the draft no longer holds), #21 (removal deletes what it
  doesn't own), #3 (ledger — a double booking is what this guards), #7 (scale), #17. **No row for
  double-booked receipts** → add with `/10x-test-plan`.

### 6. Spike code quality to fix in the real build

- `lib/db` = one statement + mapper: `loadDuplicateCandidates` runs two statements and `loadDraftProbes`
  filters in JS → split; orchestration to `lib/queries`.
- `findExpenseDraftDuplicates` throws instead of returning `ActionResultT` — follow
  `queries/investment-asset-ids.ts`.
- Duplicated SQL: skipped-media aggregate (`worker-expense-drafts.ts:67-72` vs
  `expense-duplicate-candidates.ts:39-41`), draft-pages intersection (`:370-373` vs `:405-407`), media
  JSON built three times; hand-built `'{…}'::int[]` (`:406`) where the file uses `ARRAY[${sqlList}]` (`:597`).
- `skippedMediaIds` optional in the type but always `[]` on decided rows; `duplicate-of.ts` mixes schema,
  type and UI label; `who` → `submitterName`; `draftAlreadyDecided` is the wrong notice for an empty
  intersection; strip `SPIKE` comments.

## Code References

- `src/lib/ai/openrouter.ts:40-132` — the one receipt extractor and its prompt
- `src/lib/ai/receipt-extraction-schema.ts:11-17` — extractor output schema (no NIP/number/date fields)
- `src/lib/worker-expenses/expense-draft-read.ts:5-14` — `ai_read` schema
- `src/lib/actions/transfers.ts:133-163` — bulk create + draft decision on accept
- `src/collections/transfers.ts:235-243` — `invoice` and `invoiceNote` fields
- `src/app/api/media-upload/route.ts:45-73` — server-side bytes, the hash site
- `src/lib/db/media.ts:20-28` — `insertMediaRow`, no hooks, no dimensions
- `src/lib/utils/compress-image.ts:15-57` — INVOICE/PLAN re-encode, PDF passthrough
- `src/lib/db/worker-expense-drafts.ts:203-246` — `PARAGON_ROWS` / `PARAGON_SELECT`
- `src/lib/db/worker-expense-drafts.ts:350-412` — `decideExpenseDraft`, `skipPendingReceiptAsDuplicate`
- `src/lib/db/worker-expense-drafts.ts:436-470` — `restoreSkippedReceipt`
- `src/lib/db/worker-expense-drafts.ts:549-559,640-647` — page removal and draft-held media for reclaim
- `src/lib/db/expense-duplicate-candidates.ts` — spike probes + candidates
- `src/lib/expense-duplicates/match.ts` — spike matcher
- `src/lib/db/telmak-check.ts:8`, `src/lib/telmak/compare-telmak.ts:50-54` — second consumer of number/date parsing

## Architecture Insights

- **Two planes, one document.** A paragon lives first as a draft read row (`ai_read.rows[]`, keyed by
  page ids) and then as a transakcja. A structured identity has to exist on both — optional fields on
  the read row, columns on `transactions` — so the matcher compares like with like and the audit can run
  on transakcje alone.
- **Decisions are recorded at decision time.** Skipped receipts were born inside `decideExpenseDraft`;
  the whole page-editing surface of a pending draft assumes nothing under it is decided yet. Writing the
  „Duplikat” mark through that same seam keeps the invariant; writing it on the click breaks it in five
  places.
- **Identity signals rank by robustness**: NIP + number + amount (survives re-photographing) > content
  hash + amount (survives re-sending; same device or PDF only) > amount + printed date + seller (weak).
- Precedent for „possible duplicates, point don't merge”: `archive/2026-09-28-catalogue-filters-and-usage/change.md:66-76`.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-worker-expenses/change.md` (EX-971) — drafts in a separate table so a
  forgotten filter can't move a balance; accepting creates a real wydatek.
- `context/changes/2026-10-06-worker-expense-ai-prefill/` (EX-1001) — read in `after()`, `ai_read` +
  `scan_mode`, compare-and-set write, page change nulls the read; „an AI failure is the manager's problem”.
- `context/changes/2026-10-06-worker-expense-drafts-history/change.md` (EX-1005) — `/zgloszenia-wydatkow`.
- `context/changes/2026-10-06-skipped-receipt-restore/` (EX-1009) — skipped receipt restore creates a new
  pending draft with the original send date; one row per paragon on the DB side.
- `context/archive/2026-07-26-kosztorys-invoice-note-and-preview/change.md` (EX-585) — `invoiceNote`
  line 1 = number, then items.
- `context/archive/2026-10-06-telmak-invoice-check/` (EX-982) — the table pattern reused by the hint.
- `context/archive/2026-09-22-kategorie-assetow-i-kompresja/change.md` (EX-829) and
  `context/changes/2026-10-07-media-upload-speed/`, `2026-10-07-media-upload-other-forms/`
  (EX-1012/EX-1014) — compression profiles and the ≤ 4 MB server upload path.
- `context/foundation/lessons.md:276`, `:1541`, `:2115` — dump has no blob bytes; `jsonb_array_elements`
  JIT; app-uploaded files are re-encoded. **`lessons.md:2127` is stale** (says bytes go straight to Blob;
  ≤ 4 MB now go through our server).

## Related Research

- `context/changes/2026-10-06-worker-expense-ai-prefill/research.md`

## Open Questions

1. **When is „Duplikat” written?** (a) On the click, as the spike does — then the worker paths must be
   locked down (no removing a refused page, refused pages excluded from reads/counts, non-empty
   intersection, `is_restorable` checks the parent, cascade vs audit). (b) The click removes the paragon
   from the form and marks it; `duplicate_of` is saved with `skippedReceipts` when management accepts or
   rejects. The last paragon still rejects the zgłoszenie on the click. Recommendation: (b) — same
   screen behaviour for management, none of the pending-state bugs. Needs the owner's yes, since he
   asked for „od razu odrzuca”. **→ Ruled (b), 2026-10-08 — see `change.md`.**
2. Should „OK, to nie duplikat” persist (so the audit and a reopen don't re-flag the pair), and where?
3. Hash for > 4 MB uploads: server-side full GET vs client-sent hash — or skip (mostly large PDFs).
4. Backfill of hashes and of `documentNumber` for existing transakcje: hash from `dumps/blob-mirror/`
   is cheap; number can be seeded from `invoiceNote` line 1; NIP has no source except re-reading.
5. Does `CORRECTION` belong in scope (its number matches, its amount never does)?
6. Does a deleted pending draft keep its duplicate marks for EX-1026 (FK cascade today)?
