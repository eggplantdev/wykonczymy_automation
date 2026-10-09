# Review-gate ledger — worker-expense-ai-prefill (EX-1001) · 2026-10-06

Base: `staging` @ `d350fe04` · branch `worker-expense-ai-prefill` (9e70c1e9 … c9bca7cc).
Step 0.5 (browser verification) skipped: no Playwright pass asked this turn, and every read is a paid AI call — the slice's checks live in `manual-checks.md` § EX-1001.

## Findings

- [x] 🟡 WARNING · dismissed · `impl-review` · `src/app/(frontend)/pracownicy/[id]/page.tsx` · no `maxDuration`; 8-page worst case (270 s model + 30 s fetch) brushes 300 s — the project default IS 300 s, and a killed read is only a missing prefill: „Odczytaj dodane zdjęcia” is the fallback
      test: no automated test — a platform timeout, not reproducible in a spec
- [x] 🔵 OBSERVATION · dismissed · `code-review` + `impl-review` · `src/lib/db/worker-expense-drafts.ts` `saveExpenseDraftRead` · compare-and-set under READ COMMITTED can let a stale read land after a concurrent page change — `buildDraftPrefill`'s `sameIds` match keeps such a row out of the form; why-comment added at `draft-prefill.ts:15`
      test: no automated test — already pinned by `draft-prefill.test.ts` „ignores a read row for a different set of pages”
- [x] 🔵 OBSERVATION · dropped · `impl-review` · restore from `/kosz` schedules no read — a restored draft opens blank with the button, same as any unread draft; not worth a code path
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `read-expense-draft-receipts.ts` · no `TODO(EX-449) SENTRY-REQUIRED` marker — `logError` is the single seam Sentry will hook
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · plan drift: `receipt-scan.ts` filename, `MAX_RECEIPT_PAGES` moved (import-only change in `/api/extract-receipt`), labels not moved — all benign, behaviour identical
- [x] skipped · `feature-first-structure` + `structure-scatter-audit` · `src/lib/db/expense-draft-read.ts` · schema-only file in `lib/db` — the two audits pull opposite ways (fold into a 450-LOC module vs. move statements out through a `DRAFT_MEDIA` cycle); no move is cheaper than the gain
- [x] skipped · `module-cohesion-audit` · `src/lib/db/worker-expense-drafts.ts:319-351` · AI-read cluster is a seam inside the table module — every export still targets one table; revisit only if it keeps growing
- [x] skipped · `structure-scatter-audit` · `src/lib/env/schema.ts:40` · Blob token shape parsed in two `src` homes — consolidating touches `blobTokenRefusal`, the prod-Blob guard; not a drive-by
- [x] dropped · `code-review` · `src/lib/db/worker-expense-drafts.ts:44` · `DRAFT_SELECT` returns `ai_read` to callers that ignore it — a few hundred bytes per row
- [x] dismissed · `tailwind-v4-audit` · no findings
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

## Follow-up — `1899287d..1ee6a802` (read on „Zobacz", „Odczytaj ponownie", unreadable as Opis) · 2026-10-06

Fan-out: `code-review`, `comment-noise-audit` (flag-only), `tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`. No `/10x-impl-review`: the follow-up has no plan.

- [x] 🟡 WARNING · fixed · `code-review` · `src/components/forms/expense-form/expense-form.tsx:314` · only the rows locked during the read; date/type/kasa/inwestycja stayed editable and the remount on landing reset them (and Enter could submit past the disabled „Zapisz") — the `<fieldset disabled>` now wraps the whole `FieldGroup`
      test: test-driven-debugging · unit (dom) — `expense-form-prefill.test.tsx` asserts „Typ wydatku" disabled while reading; red before the move
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/worker-expenses/pending-expense-drafts.tsx:113` · closing the dialog mid-read and reopening paid a second read; one shared pill key let draft A's read clear draft B's pill — `readsInFlight` ref skips the second read (the first one's landing finds the dialog by id), pill keyed per draft
      test: test-driven-debugging · unit (dom) — new `pending-expense-drafts.test.tsx`: reopen mid-read → one action call, filled row after landing; red before the fix
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/actions/read-expense-draft-receipts.ts:50` · a stale list (send-time read landed after it loaded) made „Zobacz" pay the model again and overwrite the stored read — `loadExpenseDraftForRead` returns `ai_read`; a stored read is returned as-is (every page/mode change already clears it)
      test: test-driven-debugging · integration — `read-expense-draft-receipts.db.test.ts` „returns a stored read without asking the AI again"; red before the fix
- [x] 🟡 WARNING · fixed · `code-review` · tests for the click-time flow — covered by the three regression specs above plus the failure-path spec below; the partial `failedIds` clear is a two-line functional update, not worth a renderHook harness of its own
- [x] 🔵 OBSERVATION · fixed · `code-review` · `pending-expense-drafts.tsx:118` · a failed action (no rights, offline, stale action id) toasted the generic „Nie odczytano zdjęć zgłoszenia" — toasts `result.error`; the generic line stays for a read that reached no answer
      test: TDD · unit (dom) — `pending-expense-drafts.test.tsx` „nieudany odczyt mówi, dlaczego…"
- [x] 🔵 OBSERVATION · dismissed · `code-review` · concurrent send-time `after()` read and click-time read both pay, last write wins — a seconds-long window right after sending; both are reads of the same pages, and the early return closes the common (stale-list) case
- [x] 🔵 OBSERVATION · skipped · `code-review` · `use-receipt-generation.ts:55` · „Odczytaj ponownie" on a hand-corrected row can replace it with the unreadable sentinel and blanks — the overwrite is the asked-for behaviour (same as the button path), „Zapisz" refuses the sentinel; keeping typed values on an unreadable result changes what the button does → owner's call
- [x] 🔵 OBSERVATION · fixed · `code-review` · `expense-form.tsx` implicit Enter-submit while reading — moot once the whole form body is disabled (first finding)
- [x] fixed · `comment-noise-audit` · `use-receipt-generation.ts:43` · second sentence described `indexedRows`, misplaced above `generateFromReceipts` — cut
- [x] fixed · `comment-noise-audit` · `pending-expense-drafts.tsx:110` · restated `!draft.aiRead` + rejected alternative + duplicated lock note — trimmed to the spend-on-click fact
- [x] fixed · `comment-noise-audit` · `src/lib/actions/worker-expense-drafts.ts:104` · first sentence restated the caller — cut
- [x] fixed · `comment-noise-audit` · `line-items-field.tsx:363` · JSX comment duplicated the guard comment at `use-receipt-generation.ts:54` — deleted
- [x] dropped · `module-cohesion-audit` · `line-items-field.tsx` (469 lines) · extract the row body to `line-item-row.tsx` — still one concern; the follow-up added 24 lines
- [x] dismissed · `tailwind-v4-audit`, `feature-first-structure`, `structure-scatter-audit` · no findings
- [x] dismissed · `simplify` + `reuse-scan` · main-thread pass over the ~10-file follow-up diff (all files read in full) — no reinvention; `readsInFlight` is not derivable from `accepting`, which moves to the other draft

Tests: typecheck clean · `forms/expense-form` + `worker-expenses` 11 files / 46 tests green · DB `read-expense-draft-receipts.db` 9/9 and `worker-expense-drafts.db` 13/13 vs 5435 (run one at a time — run together they race on `purgeFixtureUsers`) · full suite not run (not asked).

## Simplify pass

Ran /simplify — 7 applied, 0 proposed, 8 dismissed/skipped; each finding folded into ## Findings (tagged simplify). Touched specs 50 files / 312 tests + DB 31 files / 190 tests green, typecheck clean.

## Tests & suite

- typecheck — clean
- touched specs (`worker-expenses`, `forms/expense-form`, `lib/utils`, `lib/i18n`, `lib/table`, `components/ui`) — 50 files / 312 tests green
- DB specs (`read-expense-draft-receipts.db`, `lib/db`) vs 5435 — 31 files / 190 tests green
- full suite — deferred by user (2026-10-06); pre-push runs the unit + integration legs
