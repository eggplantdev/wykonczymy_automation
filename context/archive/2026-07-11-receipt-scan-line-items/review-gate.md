# Review-gate ledger — receipt-scan-line-items (EX-443) · 2026-07-11 (full re-review @ df180e3)

Re-ran the full read-only fan-out on the WHOLE change (branch diff `main...HEAD`, 47 files / 2762 ins)
after ~13 commits landed past the prior gate. Prior ledger preserved at `review-gate-prior-2026-07-11.md`.

Fan-out (7, all read-only): impl-review, code-review (HIGH), tailwind-v4-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit, comment-noise-audit. tailwind + scatter = no actionable findings.

## Findings

<!-- [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

### Correctness / safety

- [x] 🔴 CRITICAL · fixed · `impl-review`(F1) · `receipt-pdf-plugins.test.ts:9` + `receipt-extraction-schema.test.ts` · Unit suite RED at HEAD (3 fail): pdf-plugins spec pinned `engine:'pdf-text'` (code now `native`); schema fixtures predate the required `otherCategoryName`. Prior ledger's "unit green" was stale. **Fixed:** updated the 3 assertions to the deliberately-changed behavior; both specs now green.
      test: test-driven-debugging · unit — the specs ARE the regression guard; updated to assert the new native-engine + dual-category contract.
- [x] 🔵 OBSERVATION(↓ from code-review WARNING) · fixed · `code-review`(1) · `line-items-field.tsx:224` · Last-row delete guard dropped (`length===1` → `isFilling`). Reviewer's "empty submit passes" scenario is **overstated** — `expense-schema.ts:66` superRefine rejects `lineItems.length===0`, so integrity is intact; it's a UX regression only. **Fixed:** `disabled={isFilling || length===1}`.
      test: no automated test · unit — data-integrity path already guarded by the schema superRefine; the restored UI guard is cosmetic, not worth a spec.
- [x] 🟡 WARNING · fixed · `code-review`(2)+`impl-review`(F5,F7) · `openrouter.ts:23` · `RECEIPT_MODEL` shipped as the unverified trial `google/gemini-3.1-flash-lite` with no fallback → a bad/unavailable id would throw on every scan. **Fixed (user's call — runtime auto-fallback):** `extractReceipt` retries once with the new `FALLBACK_MODEL = gemini-2.5-flash` when the primary throws; a dead trial id now degrades to slower-but-working. New constant + try/catch swap.
      test: TDD · unit — `openrouter-fallback.test.ts` (3 cases): primary-throws→fallback returns; primary-ok→fallback skipped; both-fail→throws. Green.
- [x] 🔵 OBSERVATION · dismissed · `code-review`(5) · `receipt-filename.ts:9` · `url`-fallback extension parse breaks on a query-string blob URL (`.2?token=…`). Benign: `media.filename` is set for every uploaded Payload doc, so `currentName ?? url` never reaches the `url` branch in practice. Harden only if that invariant changes.
- [x] 🔵 OBSERVATION · dismissed · `code-review`(6) · `line-items-field.tsx:handleScanReceipts` · Relies on TanStack `pushValue` flushing synchronously before `onFill` reads `lineItems`. Benign: TanStack's array store is synchronous and the batch-scan flow works in practice; no async gap observed.

### Plan drift (deliberate, functionally sound — doc-only)

- [x] 🟡 WARNING · dismissed · `impl-review`(F2) · `receipt-extraction-schema.ts:15` · Dual-category (`otherCategoryName`) extraction crosses the plan's "NOT doing category(other)" boundary. Deliberate (committed `a3148de`/`8e78ada`); exact-match-or-blank mapping keeps hallucinated ids out of the form. plan.md archives with the slice.
- [x] 🟡 WARNING · dismissed · `impl-review`(F3) · `extract-receipt.ts:60-88` · "Pure read" action now mutates media (Opis rename) with `overrideAccess:true`. Deliberate (committed `8e78ada`); comment justifies the bypass (MANAGER runs the fill; media update is admin/owner-only; internal side effect of an authorized flow). Sound.
- [x] 🔵 · deferred → filed (EX-443 comment) · `impl-review`(F4 + delta F1/F2/F3) · Consolidated doc-reconciliation note owed on EX-443, covering: (a) large adjacent surface — nav-credits, env-badge, form-dialog polish, spinner, globals.css, notatka popover `dialogs/note-dialog.tsx` (`1ab8bb7`, `feat(transfers)`, out-of-slice); (b) **extraction inverted vs plan** — `a5c4dc4` drops `expenseCategory` AI-fill, keeps only `otherCategoryName`, contradicting plan.md:83/42-44/60/173/213 (deliberate product call, plan archives with slice); (c) model swap to on-trial `gemini-3.1-flash-lite` + runtime fallback, undocumented in the commit. Box checks once noted on EX-443.

**Delta re-review (df180e3..HEAD, resumed after the user's refactor):** code-review = 0 correctness bugs (removal complete/consistent, notatka popover clean, fallback intact); impl-review = 3 findings, all benign doc-reconciliation → folded into the EX-443 note above. No new code fixes.

### TEMP DEBUG (self-flagged code, not just comments)

- [x] 🟡 WARNING · skipped (kept, user's call) · `code-review`(3)+`impl-review`(F6)+`comment-noise` · `upload-file/route.ts:36` + `use-receipt-fill.ts:137-142` · Two TEMP DEBUG blocks. **Kept until Sentry (EX-449) is wired** — the only failure visibility for now; route block is console-only, toast block is `NODE_ENV`-gated (no prod leak). Retagged the misleading "remove before merge" markers to point at EX-449 so the deliberate-keep intent is recorded.

### Structure / placement (low, /simplify or defer)

- [x] fixed · `simplify`(reuse/scatter/module-cohesion) · `form-fields/resolve-expense-category-id.ts` · Pure `.ts` helper misplaced among `*-field.tsx` components; sole consumer `use-receipt-fill.ts` (+ its spec). **Moved** to `expense-form/resolve-expense-category-id.ts` (sibling of `map-line-item.ts`); both imports updated; stale "used for both selects" comment trimmed. tsc + spec green.
- [x] skipped · `module-cohesion` · `use-invoice-files.ts:6,15` · Split pure `reindexAfterRemoval`/`setFilesAt` out of the hook. Skipped: cohesion acceptable — already exported + unit-tested; the whole index-keyed apparatus is slated for rewrite in EX-448 (uuid identity), so a split now is throwaway churn.
- [x] skipped · `module-cohesion` · `upload-file-client.ts:31` · Split `resolveInvoiceMediaIds` out of `uploadFileClient`. Skipped: same file, one small concern each; the concurrency fix below is the substantive change. Not worth a new file.

### Comment noise (all /simplify candidates)

- [x] fixed · `comment-noise` · `button.tsx:30` · Deleted the `AI-accent: fuchsia→cyan…` color narration — the `gradient-border neon-glow-duo` classes encode it.
- [x] dismissed · `comment-noise` · `line-item-invoice-field.tsx:54,86` · Kept: `:54` names the empty-row branch intent, `:86` explains why a second hidden file input exists (the modal "Zamień" path). Both carry a why the code doesn't say.
- [x] fixed · `comment-noise`+TEMP-DEBUG · `upload-file/route.ts:36`, `use-receipt-fill.ts:129` · Retagged both `TEMP DEBUG` markers to `SENTRY-REQUIRED (EX-449)` with the keep-until-Sentry rationale (per user's call), instead of deleting. `line-items-field.tsx:213` layout comment left as-is (load-bearing: explains the mid-fill remove-guard).

### Cleanups (/simplify)

- [x] fixed · `simplify`(reuse/simplification/altitude)+`code-review`(7) · `use-receipt-fill.ts:29 reindexSet` dup of `use-invoice-files.ts reindexAfterRemoval` · **Routed** the Set shift through the shared `reindexAfterRemoval` (Set = key-set of an index map). Removes the correctness-adjacent drift the comment admitted. tsc + specs green.
- [x] fixed · `simplify`(reuse/simplification/altitude) · `receipt-filename.ts:9` + `upload-file.ts:8` · `buildReceiptFileName` & `uniqueFileName` each hand-rolled the same "splice short id before ext" collision guard. **Extracted** `appendShortId`/`splitExtension` (`lib/utils/append-short-id.ts`); both callers delegate. Behavior preserved (buildReceipt still lowercases ext). tsc green.
- [x] fixed · `simplify`(efficiency) · `upload-file-client.ts:37 resolveInvoiceMediaIds` · Submit uploaded every attached-but-unscanned row via unbounded `Promise.all` while the fill path caps at 4; batch-add lets 10-20+ fire at once (main-thread compress + request burst). **Routed** through `mapWithConcurrency(…, 4)` (order preserved → positional `lineItems[i]↔mediaId[i]` intact; injectable `upload` seam intact).
- [x] deferred → filed EX-451 · `simplify`(altitude) · `extract-receipt.ts:37-40` · Absolute-URL rebuild hand-rolls proto+host from request headers instead of the canonical `FRONTEND_URL`. Defensible (preview deploy must resolve `media.url` against the running host, not prod `FRONTEND_URL`) and the comment documents it, but the divergence deserves a named `getRequestOrigin()` helper so it reads as intentional. Low; file as tech debt.
- [x] fixed (was deferred → EX-452) · `simplify`(reuse) · `ui/spinner.tsx` vs `ui/loader/spinner.tsx` · Two components both exported as `Spinner` — readability trap. **Renamed** the new one → `GradientSpinner` (`ui/gradient-spinner.tsx`, `git mv` preserves history); sole importer `line-items-field.tsx` updated (2 usages). Rejected the "variant" alternative: the two differ by render technique (bordered-ring vs gradient-mask) and sizing contract (fixed `w-10` vs `className`-driven), so a shared `variant` prop would toggle implementations, not vary one axis, and rewrite the loader's API. tsc clean. EX-452 closed as done (fixed in-branch, not deferred).
- [x] 🔵 · dismissed · `code-review`(8)/`simplify`(efficiency) · `nav-credits.tsx:18` · Wallet balance refetched every mount (`cache:'no-store'`). Confirmed benign by the efficiency pass: `NavCredits` lives in the persistent `(frontend)/layout.tsx`, so the effect fires once per full load, not per client nav; server-side fetch would block layout render up to the 4s OpenRouter timeout. Current design is the cheaper one.
- [x] 🔵 · dismissed · `code-review`(4) · `env/schema.ts` · `OPENROUTER_API_KEY` unconditionally required. **Consistent with repo convention** (every var required, no default). Deploy note: add the key to all Vercel preview branches (see `feedback_vercel_env_add_preview_all_branches`).

## Simplify pass

Ran /simplify (4 cleanup agents: reuse / simplification / efficiency / altitude) over `main...HEAD` +
working tree — **6 applied, 2 proposed (deferred → Linear), 4 skipped/dismissed**; each folded into
`## Findings` above (tagged `simplify`). No second finding list here.

Applied: `appendShortId`/`splitExtension` dedup · `reindexSet`→`reindexAfterRemoval` dedup ·
`resolveInvoiceMediaIds` concurrency cap · helper move to `expense-form/` · TEMP DEBUG retag ·
`button.tsx` comment delete. Deferred: `getRequestOrigin()` extraction · `Spinner` name collision.
Skipped: two hook cohesion-splits (EX-448 will rewrite the apparatus), two invoice-field comments (carry a why).

Post-pass gate: `pnpm typecheck` clean; affected specs (resolve-expense-category-id, openrouter-fallback,
receipt-extraction-schema, receipt-pdf-plugins) 13/13 green.

## Tests & suite

- Fixed 3 RED specs (Step 1) — `receipt-pdf-plugins` + `receipt-extraction-schema` now green.
- Post-/simplify affected specs: 13/13 green; typecheck clean.
- Step 3 — remaining tests: none new. The /simplify dedups are behavior-preserving and covered by the
  existing `append-short-id`-fed callers' specs + the reindex/fallback specs; the receipt-scan **browser**
  risk is already filed as E2E backlog **EX-447**. Notatka popover is low-risk UI, no spec owed.
- Full suite (user chose **fast legs**): `typecheck` clean · `lint` = 15 errors, all pre-existing `no-undef`
  (console/process) in `scripts/*.mjs` untouched by this branch, **0 in slice files** · unit `vitest run` =
  **830 passed, 24 skipped** (DB-integration specs skip without a live DB). `test:e2e` + `build` deferred to
  the user.
