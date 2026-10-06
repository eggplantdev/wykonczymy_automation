---
date: 2026-10-06T10:15:00+02:00
researcher: Claude (Opus 5.5)
git_commit: d350fe044d202a8520c69c6b99be090db0a03a05
branch: staging
repository: wykonczymy
topic: "AI reads a worker's expense-draft photos on send (after()), stored on the draft, prefills the manager's dialog; plus a manager re-read button"
tags: [research, codebase, worker-expense-drafts, receipt-scan, after, expense-form, openrouter]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Owner decisions on open questions 2–6'
---

# Research: worker-expense-ai-prefill (EX-1001)

**Date**: 2026-10-06T10:15:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: d350fe04
**Branch**: staging
**Repository**: wykonczymy

## Research Question

How to (1) run the receipt AI read server-side in `after()` when an EMPLOYEE sends an expense draft
(and when its pages change), store the result on the draft, and prefill the manager's „Nowy
wydatek" dialog from it; and (2) add a manager button „Odczytaj dodane zdjęcia" that re-reads photos
already attached to a still-blank row. Scope from `change.md`.

## Summary

Every piece exists; the work is wiring plus three seams.

1. **The AI core is already bytes-based.** `extractReceipt(pages: ReceiptPageT[], names)` takes
   `{bytes, mediaType, filename}` (`src/lib/ai/openrouter.ts:38,47`). Only the `File → page` step
   in `scanReceipt` (`src/lib/ai/scan-receipt.ts:19-27`) ties it to the browser — split it and the
   server path reuses the rest (filename build, netto range drop).
2. **Getting the bytes is the one genuinely new piece.** No server code anywhere reads a stored
   media file's bytes. `media.url` is the relative Payload proxy path `/api/media/file/<filename>`
   (`src/lib/queries/media.ts:24-26`), unfetchable server-side as-is. Blob is **public**
   (`src/lib/media/client-upload.ts:54`); the only precedent builds the direct Blob URL from the
   store id (`src/scripts/backfill-heic-media.ts:178-186`).
3. **`after()` on a worker send has a working precedent** — `after(() => translateReportExtras(db,
reportId))` (`src/lib/actions/worker-report.ts:67`): swallow + `logError`, write guarded so a
   manager's retry is never overwritten, and the manager's retry button covers a failed automatic
   run (`context/reference/kosztorys-editor-domain-notes.md:542-558`).
4. **No cache to refresh.** Draft reads are uncached (`src/lib/queries/worker-expense-drafts.ts:17-27`),
   no draft tag exists, so the `after()` write needs no `revalidateTag` — which also sidesteps the
   „no second exit via `after()`" lesson (`context/foundation/lessons.md:686-695`).
5. **The re-read button is a thin wrapper.** `generateFromReceipts` already does exactly „re-read
   attached files on blank rows" (`use-receipt-generation.ts:40-48`); today it is reachable only via
   the file-picker's empty-pick branch, which a cancelled picker never fires.
6. **Two number mismatches**: a draft holds up to `MAX_DRAFT_PAGES = 20`
   (`src/lib/constants/worker-expense-drafts.ts:6`), one read takes at most `MAX_RECEIPT_PAGES = 8`
   (`openrouter.ts:36`); worst-case read time is `(30 + 15×(n−1)) × 2` s — 270 s at 8 pages, against
   a 300 s function ceiling that `after()` work counts toward.

The gap itself: EX-971's owner decision promised the dialog opens with „tym, co AI odczyta z
paragonu" (`context/archive/2026-10-05-worker-expenses/change.md:44-48`); no rationale for dropping
it exists. The staging manual check ticked „Generuj wypełnia kwotę i opis" by uploading a NEW photo
(`context/foundation/manual-checks.md:3855-3856`) — which is exactly the path that works.

## Detailed Findings

### Draft data model

- `worker_expense_drafts` — `src/migrations/20261005_3_add_worker_expense_drafts.ts:8-21`: `id`,
  `worker_id`/`investment_id`/`cash_register_id` (CASCADE), `note`, `status` (`pending|accepted|rejected`,
  CHECK :19), `sent_at`, `decided_at` (CHECK pending ⇔ null :20), `decided_by`, `transfer_id`.
- Pages: `worker_expense_draft_media(draft_id, media_id, position)`, PK `(draft_id, media_id)` (:32-37).
- Row type + mapper: `ExpenseDraftRowT` (`src/lib/db/worker-expense-drafts.ts:12-25`),
  `DRAFT_SELECT` (:27-40, `json_agg … ORDER BY dm.position`), `toDraftRow` (:42-63). **A new column
  lands in both.**
- Every worker-side write is scoped `worker_id = me AND status = 'pending'` (update :222, append
  :240, remove :266, delete :287) — after a decision the worker cannot change pages, so a read can
  only go stale while pending.
- Latest migration: `src/migrations/20261005_6_add_worker_report_scan.ts`; convention
  `YYYYMMDD_<n>_<name>.ts`, `ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS`, registered in
  `src/migrations/index.ts`. Next: `20261006_1_…`. Additive → prod migrate **before** push.

### Actions — where the read hooks in

`src/lib/actions/worker-expense-drafts.ts` — all worker actions run under `sessionAction`, none
revalidates or calls `after()`; the client `router.refresh()`es itself
(`expense-draft-pages-cell.tsx:33-38`, `expense-draft-dialog.tsx:110`).

| Action                              | Hook point                                                      |
| ----------------------------------- | --------------------------------------------------------------- |
| `sendExpenseDraftAction` :61        | after `draftId` non-null, :80-81                                |
| `addExpenseDraftPagesAction` :122   | after `isAdded`, :139-140                                       |
| `removeExpenseDraftPageAction` :145 | after `isRemoved`, :157-158 (beside `reclaimUnreferencedMedia`) |
| `updateExpenseDraftAction` :164     | none — investment/kasa/note only                                |

`db` from `getDb(payload)` without `req` is the process-wide drizzle handle
(`src/lib/db/get-db.ts:12-18`), valid after the response. Fallback where `after` throws (scripts,
node specs): `try { after(fn) } catch { await fn() }` (`src/lib/media/delete-unreferenced-media.ts:68-76`).

Accept path: `createBulkTransferAction(data, pages, { expenseDraftId })`
(`src/lib/actions/transfers.ts:89,155-163`) flips the draft to `accepted` in the same transaction;
**no media relinking** — the manager's dialog downloads the pages client-side and re-uploads them
(`pending-expense-drafts.tsx:41-49,61-62`). So the AI filename can simply be applied to the
downloaded Files before prefill.

### The AI read

- `extractReceipt` (`src/lib/ai/openrouter.ts:47-139`): `RECEIPT_MODEL = google/gemini-3.1-flash-lite`
  (:18) + `withModelFallback` → `gemini-2.5-flash` (`openrouter-client.ts:23-37`); per-attempt
  timeout `30 s + 15 s × (pages−1)` (:24,29,92-95); PDFs via `receiptPdfPlugins` (:90); unreadable
  logged under a SENTRY marker (:121-131). Owner ruling 2026-10-05: model stays as is
  (`context/changes/2026-10-05-worker-report-scan/plan.md:88`).
- Schema (`receipt-extraction-schema.ts:11-17`): `description`, `amount?`, `netAmount?`,
  `invoiceNote`, `otherCategoryName`; sentinel `UNREADABLE_RECEIPT` (:6).
- `scanReceipt` (`scan-receipt.ts:15-50`) adds the Opis-based `filename` (skipped on the sentinel) and
  drops a netto ≤ 0 or > brutto (:43-47).
- `otherCategoryNames`: the client sends `otherCategories.map(c => c.name)`
  (`use-receipt-generation.ts:56`), but the category is **never written** to the row
  (`apply-receipt-to-row.ts:8-9`). Server side can pass `[]` (prompt prints `(none)`,
  `openrouter.ts:52`) — no need to load reference data in `after()`.
- `/api/extract-receipt` (`src/app/(frontend)/api/extract-receipt/route.ts`) is `requireAuth(MANAGEMENT_ROLES)`
  (:30), `maxDuration = 300` (:20). It stays the manager's browser path; the worker never calls it.

### Bytes from Blob

- Media is `vercelBlobStorage` with `clientUploads` (`payload.config.ts:117-128`), uploads
  `access: 'public'` (`client-upload.ts:54`), collection `read: () => true` (`collections/media.ts:67`).
- `ExpenseDraftMediaT = {id, url, filename, mimeType}` (`worker-expense-drafts.ts:10`) — `url` relative.
- Precedent: `https://<storeId>.public.blob.vercel-storage.com/${encodeURIComponent(filename)}`, store
  id parsed from `BLOB_READ_WRITE_TOKEN` (`backfill-heic-media.ts:178-186`; token shape
  `src/lib/env/schema.ts:13-16`). Alternative: `head()` from `@vercel/blob` for the canonical URL.
- Local dev/preview point at the **preview** store (AGENTS.md § Blob), so a draft photo newer than the
  last restore 404s locally — the read fails, which is the „manager's problem" path, not a crash.
- Worker pages are compressed client-side with the `INVOICE` profile (edge 1920, q 0.6;
  `compress-image.ts:15-25`); PDFs pass through untouched (`process-upload-file.ts:97`).

### Manager dialog + re-read button (client)

- `handleOpen` (`pending-expense-drafts.tsx:63-95`) builds `prefill.values.lineItems =
[makeLineItem({ expenseCategory })]` and `files: new Map([[0, files]])` — all pages on row 0, one
  multi-page invoice.
- No pure „receipt → line-item values" helper; `applyReceiptToRow` (`apply-receipt-to-row.ts:16-28`)
  writes through `setFieldValue`. Extract `receiptToLineItemValues(data)` →
  `{description, amount, netAmount, invoiceNote}`; `makeLineItem` takes `Partial<BulkLineItemT>`
  (`bulk-expense-form.ts:30`), and `applyReceiptToRow` can loop over the same result.
- Filename: `renameFile` clones each page via `pageFilename(name, index)` (`use-invoice-files.ts:107-138`;
  page 1 bare, then `-2`, `-3`). `pageFilename` is module-private — export or move it to
  `src/lib/utils/receipt-filename.ts` to rename the downloaded Files in `handleOpen`.
- `generateFromReceipts` eligibility: `files.has(row.id) && !description && !amount` (:46-48);
  returns silently when nothing is eligible (:50). A failed row stays blank → eligible again. A row
  filled with `UNREADABLE_RECEIPT` is **not** eligible until the Opis is cleared, and the schema blocks
  submitting it (`bulk-expense-schema.ts:61,127`).
- Button home: inside the `onGenerate &&` fragment after „Wygeneruj z paragonów"
  (`line-items-field.tsx:397-421`), `onClick={onGenerate}`, same `disabled`; visible when
  `lineItemsField.state.value.some(r => getRowFiles(r.id)?.length && !r.description && !r.amount)`.
- Consumers: `LineItemsField` only in `expense-form.tsx`; `ExpenseForm` in `dialogs/expense-dialog.tsx:27`
  (regular „Nowy wydatek") and `pending-expense-drafts.tsx`. The button would also show in the
  regular dialog when an eligible row exists (files attached via the per-row FV input, or a failed
  scan) — harmless and useful.
- The uncommitted stopgap (`expense-form.tsx:275-283` effect + `expense-form-prefill.test.tsx:88-117`)
  is what this change replaces.

### Worker side

Nothing to show: `draft-status-badge.tsx` knows pending/accepted/rejected only; the worker never sees
AI state — matches the ai-translations precedent (manager-only AI surfaces).

## Code References

- `src/lib/actions/worker-expense-drafts.ts:61-83,122-162` — send / add page / remove page
- `src/lib/db/worker-expense-drafts.ts:10-63,83,232,258` — row type, select, mapper, insert, page writes
- `src/migrations/20261005_3_add_worker_expense_drafts.ts` — draft schema
- `src/lib/ai/scan-receipt.ts:15-50` — File→page step to split
- `src/lib/ai/openrouter.ts:18-139` — `extractReceipt`, model, timeouts, `MAX_RECEIPT_PAGES`
- `src/lib/actions/worker-report.ts:67`, `src/lib/actions/translate-report-lines.ts:27-35` — `after()` precedent
- `src/lib/media/delete-unreferenced-media.ts:68-76` — `after` / inline fallback
- `src/scripts/backfill-heic-media.ts:178-186` — direct Blob URL precedent
- `src/components/worker-expenses/pending-expense-drafts.tsx:41-95` — download + prefill
- `src/components/forms/expense-form/use-receipt-generation.ts:40-128` — client re-read
- `src/components/forms/form-fields/line-items-field.tsx:185-205,397-426` — scan block
- `src/components/forms/expense-form/apply-receipt-to-row.ts:16-28` — field mapping
- `src/components/forms/expense-form/use-invoice-files.ts:107-138` — `renameFile` / `pageFilename`
- `src/__tests__/lib/actions/worker-expense-drafts.db.test.ts:12-16` — `after: () => {}` stub (discards work)

## Architecture Insights

- **Compare-and-set, late answer loses.** The ai-translations write lands only where the target is
  still untranslated (`setLineTranslations(…, { onlyUntranslated: true })`), and the domain notes
  make it a rule: „spóźniona odpowiedź przegrywa" (`kosztorys-editor-domain-notes.md:542-547`). Here
  the input is the page set: a read made from pages {A,B} must not land after the worker removed B.
  Store a fingerprint of the pages the read used (ordered media ids) and write
  `WHERE status = 'pending' AND <current pages> = <fingerprint>`; a page change clears the read in the
  same statement that changes the pages.
- **Manager retry goes straight past the automatic run.** The translations retry uses the stronger
  model because the cheap one repeats itself (`domain-notes.md:552-558`). For receipts the client path
  already runs `withModelFallback`; whether the re-read button should skip straight to the fallback is
  a plan decision, not a given.
- **No gate on OpenRouter** — deliberate (`context/reference/outgoing-effects-isolation.md:70-78`):
  damage is money, capped by the account. Consequence: dev, preview and any future E2E draft spec make
  **real, billed** reads from `after()`, and E2E can't intercept a server call with `page.route`.
- **`after()` spec stubs.** `worker-expense-drafts.db.test.ts:13-16` stubs `after: () => {}` — once the
  send schedules the read, that stub silently discards it (`lessons.md:2134-2165`). Collect-and-flush
  precedents: `src/__tests__/lib/actions/worker-report.test.ts:16-22`, `translate-at-creation.test.ts:24-30`.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-worker-expenses/change.md:38-48` — worker sends inwestycja + photos +
  note only; manager fills the rest „ręcznie albo przez AI z paragonu"; dialog promised AI prefill.
- `context/archive/2026-10-05-worker-expenses/review-gate.md:28` — dropped: an open dialog doesn't see
  a worker's mid-review edit („version check costs more than the race"). A read landing after the
  manager opened the dialog is the same race; the re-read button is the answer, not a live refresh.
- `context/archive/2026-10-05-worker-expenses/review-gate.md:17-22,39-42,54` — five findings „fixed
  (spec not yet run)"; typecheck/lint/suite not run at the gate. This change builds on draft specs
  that have not been verified green.
- `context/archive/2026-10-05-worker-expenses/review-gate.md:23` — EX-997, E2E backlog for worker
  sends → manager accepts.
- ai-translations `change.md:45,58,64-67`, `review-gate.md:10,14` — AI in `after()` on the worker's
  send, failure leaves the row unread, manager retry from the review dialog; worker-triggered spend
  cap dropped; ~420 s worst case vs 300 s accepted.
- `context/changes/2026-10-05-worker-report-scan/research.md:156-172` — receipt pipeline facts; notes
  the no-gate reasoning was written for company invoices and worker uploads „may deserve a line".
- `context/foundation/manual-checks.md:3853-3856` — EX-971 checks: „kwota pusta" on open becomes wrong;
  the „Generuj" tick was verified with a new upload, not the draft's photos.

## Related Research

- `context/changes/2026-10-05-worker-report-scan/research.md`
- `context/archive/2026-10-05-worker-expenses/` (change.md, review-gate.md)

## Decisions (owner, 2026-10-06)

1. **Unreadable → blank.** The `UNREADABLE_RECEIPT` sentinel is not stored; that row opens blank and
   „Odczytaj dodane zdjęcia" offers itself.
2. **Cap worker drafts at 8 pages** — `MAX_DRAFT_PAGES` 20 → 8, equal to `MAX_RECEIPT_PAGES`, so a
   draft is always readable in one call.
3. **Both scan modes, chosen by the worker.** The manager's form already offers „Każde zdjęcie to
   osobny paragon" / „Wszystkie zdjęcia to jedna faktura" (`ScanModeT`, `line-items-field.tsx:52-62`).
   The read happens at the worker's send, so the worker makes the same choice in the draft dialog;
   it is stored on the draft. `one-per-photo` → one read per page (parallel, each a 1-page call) and
   one prefilled row per page; `one-invoice` → one read over all pages, one row (today's prefill).
   The manager's dialog follows the stored mode.
4. **Bytes: direct public Blob URL.** No extra API round-trip and no new SDK call; the URL is a pure
   function of the store id + filename. Lift the builder out of `backfill-heic-media.ts:178-186` into
   `src/lib/media/` so the script and the action share one copy. `head()` would buy only a canonical
   URL we can already derive, at one request per page.
5. **Storage: one `ai_read jsonb`** (follows from 3): an array of `{ mediaIds, description, amount,
netAmount, invoiceNote, filename }`, one entry per resulting row; plus `scan_mode`. A variable-length
   per-row result doesn't fit typed columns. Staleness: compare each entry's `mediaIds` with the
   draft's current pages.
6. **Re-read model — out of scope.** The existing client path stays as is.

## Open Questions

1. **Manual checks** — `manual-checks.md:3853-3856` need rewording; new checks for „worker sends →
   manager opens prefilled rows" (both modes) and „remove a page → stale read is not used".
2. **Test-plan anchor** — candidate new risk: „a stale or late AI read prefills from photos no longer
   on the draft, or overwrites the manager's input".
3. **Existing drafts above 8 pages** — 0 on the local copy (max 7). Re-count on prod before the cap
   ships; a pending draft with 9–20 pages would stay unread and be handled by hand.
