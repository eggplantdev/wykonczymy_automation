# Review-gate ledger — worker-expense-ai-prefill (EX-1001) · 2026-10-06

Base: `staging` @ `d350fe04` · branch `worker-expense-ai-prefill` (9e70c1e9 … c9bca7cc).
Step 0.5 (browser verification) skipped: no Playwright pass asked this turn, and every read is a paid AI call — the slice's checks live in `manual-checks.md` § EX-1001.

## Findings

- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` · `src/lib/actions/read-expense-draft-receipts.ts:44` · server read had no 8-page guard; a pending „Jeden wydatek” from before the cap (9–20 pages) would be sent to the model as one call — now returns early. plan.md Migration Notes corrected: such a draft is readable by neither path (the button's 9+ pages get a 400), the manager fills it by eye
      test: TDD · integration — `read-expense-draft-receipts.db.test.ts` „leaves a „Jeden wydatek” over 8 photos unread”, red before the guard
- [x] 🟡 WARNING · dismissed · `impl-review` · `src/app/(frontend)/pracownicy/[id]/page.tsx` · no `maxDuration`; 8-page worst case (270 s model + 30 s fetch) brushes 300 s — the project default IS 300 s, and a killed read is only a missing prefill: „Odczytaj dodane zdjęcia” is the fallback
      test: no automated test — a platform timeout, not reproducible in a spec
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/worker-expenses/expense-draft-dialog.tsx:74` · worker could pick 9+ photos and upload them all over mobile data before the server refused the count — „Wyślij” now disabled with „Najwyżej 8 zdjęć w jednym wydatku…” (pl/uk/ru)
      test: TDD · unit (dom) — `expense-draft-dialog-mode.test.tsx` „nine photos block „Wyślij” before anything goes up”
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/forms/form-fields/line-items-field.tsx:191` · „Wygeneruj z paragonów” reused the single empty row even when it held the draft's photos, appending the new receipt to them — `reuseFirstRow` now also requires the row to carry no files
      test: test-driven-debugging · unit (dom) — `expense-form-prefill.test.tsx` „„Wygeneruj z paragonów” nie dokleja nowego paragonu…”, red before the fix
- [x] 🔵 OBSERVATION · dismissed · `code-review` + `impl-review` · `src/lib/db/worker-expense-drafts.ts` `saveExpenseDraftRead` · compare-and-set under READ COMMITTED can let a stale read land after a concurrent page change — `buildDraftPrefill`'s `sameIds` match keeps such a row out of the form; why-comment added at `draft-prefill.ts:15`
      test: no automated test — already pinned by `draft-prefill.test.ts` „ignores a read row for a different set of pages”
- [x] 🔵 OBSERVATION · dropped · `impl-review` · restore from `/kosz` schedules no read — a restored draft opens blank with the button, same as any unread draft; not worth a code path
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `read-expense-draft-receipts.ts` · no `TODO(EX-449) SENTRY-REQUIRED` marker — `logError` is the single seam Sentry will hook
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · plan drift: `receipt-scan.ts` filename, `MAX_RECEIPT_PAGES` moved (import-only change in `/api/extract-receipt`), labels not moved — all benign, behaviour identical
- [x] fixed · `feature-first-structure` · `src/lib/media/blob-public-url.ts:15` · `lib/media` imported an AI type for `fetchMediaBytes`' return — now structural, the `lib/media → lib/ai` edge is gone
- [x] skipped · `feature-first-structure` + `structure-scatter-audit` · `src/lib/db/expense-draft-read.ts` · schema-only file in `lib/db` — the two audits pull opposite ways (fold into a 450-LOC module vs. move statements out through a `DRAFT_MEDIA` cycle); no move is cheaper than the gain
- [x] skipped · `module-cohesion-audit` · `src/lib/db/worker-expense-drafts.ts:319-351` · AI-read cluster is a seam inside the table module — every export still targets one table; revisit only if it keeps growing
- [x] skipped · `structure-scatter-audit` · `src/lib/env/schema.ts:40` · Blob token shape parsed in two `src` homes — consolidating touches `blobTokenRefusal`, the prod-Blob guard; not a drive-by
- [x] dropped · `code-review` · `src/lib/db/worker-expense-drafts.ts:44` · `DRAFT_SELECT` returns `ai_read` to callers that ignore it — a few hundred bytes per row
- [x] fixed · `comment-noise-audit` · 8 deletes (`worker-expense-drafts-worker.db.test.ts`, `expense-draft-dialog-mode.test.tsx`, `scan-receipt.test.ts`, `scan-receipt.ts`, `receipt-scan.ts` ×2, `lib/db/worker-expense-drafts.ts`, `receipt-filename.ts`) + 3 trims (`apply-receipt-to-row.ts`, `draft-prefill.ts`, `expense-draft-read.ts`)
- [x] dismissed · `tailwind-v4-audit` · no findings
- [x] 🔵 OBSERVATION · fixed · `simplify` (altitude) · `src/components/worker-expenses/expense-draft-pages-cell.tsx` · adding photos to an existing draft uploaded all of them before the server refused a count over 8 (the cap fell 20→8 in this slice, so it is now reachable) — refused before upload with the same notice as the dialog
      test: TDD · unit (dom) — `expense-draft-pages-cell.test.tsx` „two photos on top of seven are refused before anything goes up”, red without the guard
- [x] fixed · `simplify` (reuse) · `src/lib/utils/same-items.ts` · ordered array equality written 3× (`sameKeys` in `lib/table/column-order.ts`, `sameIds` in `draft-prefill.ts`, inline in `lib/i18n/section-translations.ts:47`) — one generic `sameItems`; both `sameKeys` importers repointed
- [x] fixed · `simplify` (reuse) · `src/lib/utils/receipt-filename.ts` · page-rename clone loop written twice (`use-invoice-files.ts` `renameFile`, `draft-prefill.ts`) — `renamePages(pages, name)`, `pageFilename` now module-private
- [x] fixed · `simplify` (reuse) · `src/components/forms/expense-form/bulk-expense-form.ts` · „blank row” predicate (`!description && !amount`) in 3 places (generation filter, „Odczytaj dodane zdjęcia” visibility, `reuseFirstRow`) — `isBlankRow`
- [x] fixed · `simplify` (reuse) · `src/components/forms/form-fields/line-items-field.tsx:53` · scan-mode labels + hints hardcoded beside the identical `pl.expenseDrafts.scanMode*` keys this slice added — read from `pl`
- [x] fixed · `simplify` (simplification) · `src/lib/db/worker-expense-drafts.ts` `saveExpenseDraftRead` · returned a boolean no caller read, plus an empty-list guard the caller already makes impossible — `Promise<void>`, no `RETURNING`; `ARRAY[]::int[]` verified valid on Postgres
- [x] fixed · `simplify` (simplification) · `src/components/worker-expenses/expense-draft-dialog.tsx:66` · `draft?.scanMode ?? 'one-invoice'` ×3 + `hasPhotos` derivable from `photoCount` — `savedScanMode`, `photoCount > 0`
- [x] dismissed · `simplify` (reuse) · `src/lib/media/blob-public-url.ts:15` · annotate `fetchMediaBytes` with `ReceiptPageT` — reverses the `lib/media → lib/ai` edge the structure fix just removed
- [x] dismissed · `simplify` (reuse) · `blobStoreIdOf` vs `src/lib/env/schema.ts:40` · same as the skipped scatter finding above — the prod-Blob guard is not a drive-by
- [x] dismissed · `simplify` (altitude) · `src/lib/db/worker-expense-drafts.ts` `clearRead` · merge a keyed row instead of wiping the read on a page change — the plan's accepted full-re-read rule; behaviour-changing
- [x] dismissed · `simplify` (altitude) · an unreadable page stored as a blank row invites a re-read — the re-read is an explicit manager click, and `bulk-expense-schema` refuses the UNREADABLE placeholder on submit
- [x] dismissed · `simplify` (altitude) · move the 8-page cap into `scanReceiptPages` — its two callers answer differently (user-facing 400 vs. silent skip in `after()`)
- [x] skipped · `simplify` (altitude) · unify `ReceiptValuesT` with the stored `ExpenseDraftReadRowT` — reshapes persisted jsonb; a review of its own, not a cleanup
- [x] dismissed · `simplify` (efficiency) · `src/lib/db/worker-expense-drafts.ts:263` `clearRead` · a page change in „Kilka wydatków” re-reads every page instead of only the touched one — plan.md Performance Considerations accepts a full re-read per change (cents) for one freshness rule; a per-row patch adds a second
- [x] dismissed · `simplify` (efficiency) · `src/lib/actions/worker-expense-drafts.ts:147,163` · a burst of page edits starts overlapping reads, all but the last discarded by the compare-and-set — same accepted cost; an extra pre-model reload only narrows the window
- [x] dismissed · `reuse-scan` · `src/lib/media/blob-public-url.ts:14` `fetchMediaBytes` vs `src/scripts/backfill-heic-media.ts:183` `fetchBlob` · different contracts: the script's wrapper returns the raw `Response` for HEAD/PUT and its own abort-before-write handling; the slice already moved the script's token regex and URL builder onto `blobStoreIdOf` / `blobPublicUrl`
- [x] dismissed · `reuse-scan` · `pending-expense-drafts.tsx:42` `downloadPages` vs `fetchMediaBytes` · client-side, reads the relative `media.url` through the app route; the server read has no such route — two boundaries, not one helper
- [x] dismissed · `reuse-scan` · catalogue of `lib/media`, `lib/utils`, `lib/ai`, `lib/db`, `lib/env`, `hooks`, `forms/expense-form`, `forms/hooks` — no further reinvention; the array-equality, page-rename, blank-row and label dupes it would have caught are the `simplify` fixes above

## Simplify pass

Ran /simplify — 7 applied, 0 proposed, 8 dismissed/skipped; each finding folded into ## Findings (tagged simplify). Touched specs 50 files / 312 tests + DB 31 files / 190 tests green, typecheck clean.

## Tests & suite

- typecheck — clean
- touched specs (`worker-expenses`, `forms/expense-form`, `lib/utils`, `lib/i18n`, `lib/table`, `components/ui`) — 50 files / 312 tests green
- DB specs (`read-expense-draft-receipts.db`, `lib/db`) vs 5435 — 31 files / 190 tests green
- full suite — deferred by user (2026-10-06); pre-push runs the unit + integration legs
