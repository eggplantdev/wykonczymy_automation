mamy # Review-gate ledger — podsumowanie-podwykonawcow · 2026-07-21

Scope: PR #31 diff vs `origin/staging`, HEAD `3fc35958` (7 commits `7a88f088`..`3fc35958`).
Note: `3fc35958` (page.tsx concurrency) is committed locally, not yet in PR #31.

## Findings

<!-- ONE checkbox per finding — every source folds in here.
     Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry a test sub-line. Most-severe first. -->

### tailwind-v4-audit (complete)

- [x] dismissed · tailwind · `subcontractor-summary.tsx:163,201` · inline `gridTemplateColumns` style — justified: runtime-computed template-column from SUMMARY\_\*\_COL constants, matches existing kosztorys-summary/etap-totals pattern; utilities can't express it.
- [x] dismissed · tailwind · `subcontractor-summary.tsx:115` · `max-h-[calc(100vh_-_11rem)]` — correct v4 underscore syntax, viewport-relative one-off with no token; consistent with kosztorys-editor-body precedent.

### module-cohesion-audit (complete)

- [x] dismissed · module-cohesion · slice-wide · no grab-bag introduced — subcontractor-summary.tsx is a component + own contract types + local helpers (carve-out); sum-transfers.ts additions on-topic; pre-existing export density predates slice, not worsened in kind.

### feature-first-structure (complete)

- [x] dismissed · feature-first · slice-wide · every file in its established tier (lib/db → lib/queries → lib/kosztorys → components/kosztorys); own contract types colocated; types/reference-data promotion justified by genuine 4-layer cross-cutting use.

### structure-scatter-audit (complete)

- [x] dismissed · structure-scatter · slice-wide · 0 scatter — all 3 splits reproduce existing repo conventions (kosztorys calc/lib vs UI/components; db-sum vs cached-wrapper; raw query types in types/ vs derived types colocated).

### comment-noise-audit (complete — fixes deferred to /simplify Step 2)

- [x] fixed · comment-noise · `subcontractor-summary.tsx` (`{/* Headline figures + per-worker totals… */}`) · deleted — restated the two component names below it.
- [x] fixed · comment-noise · `subcontractor-summary.tsx` (SubcontractorSummary doc block) · trimmed the render-narration first half; kept EX-558 no-VAT + owner-only-links why.
- [x] fixed · comment-noise · `subcontractor-summary.tsx` (`// Per-worker zaliczki totals…`) · deleted — restated WorkerTotals + the visible Link.
- [x] dismissed · comment-noise · `page.tsx:36` (`// The individual realized PAYOUT rows — feed…`) · kept — matches the file's per-fetch one-line-why pattern; trimming only this one leaves an inconsistent gap.
- [x] fixed · comment-noise · `reference-data.ts` (`// The un-summed PAYOUT rows…`) · trimmed to the "same cache contract as above" rationale, dropped the fn-name restatement.
- [x] skipped · comment-noise · `kosztorys-totals-panel.tsx:26,28` (payoutsByWorker/payoutTransactions prop comments) · restate type names — file is DIRTY in working tree (parallel-agent edits incl. a reverted TEMP comment); never-mutate-a-parallel-tree → defer, apply once tree settles.
- [x] dismissed · comment-noise · `subcontractor-summary.ts` (`// Null-worker bucket last…`) · marks the comparator ordering as deliberate — keep, worth the intent marker.

### 10x-impl-review (complete)

- [x] 🟡 WARNING · fixed(doc) · impl-review · `subcontractor-summary.tsx:88-166` + new query/type/prop surface · F1: sortable wypłaty list contradicted change.md Decyzja #3 „nie surowa lista". Not a code defect — owner asked for it this session. FIXED: change.md Decyzja #3 amended with a dated supersession recording the owner's new ask (raw sortable/virtualized list under the totals). (No test disposition — doc drift.)
- [x] dismissed · impl-review · `subcontractor-summary.tsx:117-124` · F2: two side-by-side grids + „Podsumowanie pracowników" label diverge from change.md ASCII sketch — same stale-sketch root as F1, this is the owner-requested layout; covered by the F1 doc update. Figures correct.
- [x] dismissed · impl-review · `kosztorys-view-menu.tsx:100-127` · F3: netto/brutto toggle gated in view-menu not the plan-named totals-panel — plan named the wrong file; impl matches intent (toggle hidden in Z/Bez narzędzi). Benign.
- [x] dropped · impl-review + code-review · `kosztorys-totals-panel.tsx:94-97` + `subcontractor-summary.tsx:88` · F4: computeSubcontractorSummary invoked twice. Both reviewers agree minor — pure O(workers) recompute; threading the summary down changes 4 files' prop contracts, not worth the churn (and the panel file is dirty anyway).

### code-review (complete)

- [x] 🟡→dismissed(false-positive) · code-review · `src/lib/db/sum-transfers.ts` (getPayoutTransactionsForInvestment) · code-review claimed „Wg daty" sorts by weekday because the driver returns a JS Date → `String(Date)`. DISPROVEN by test: `@payloadcms/db-vercel-postgres` `db.execute` returns timestamptz as a year-first string ("2026-07-18 09:00:00+00"), which is lexically == chronologically sortable — the sort was never broken. Production code unchanged (kept `String(row.date)` with a corrected comment).
      test: test-driven-debugging · integration — AUTHORED `get-payout-transactions.test.ts` as a guard anyway: pins that the emitted date sorts lexically == chronologically (verified red on a weekday-first remap, green now). Not a bug fix, but a real regression guard on the sortable-date invariant.
- [x] dropped · code-review · `sum-transfers.ts` (sumPayoutsByWorker + getPayoutTransactions two queries over same PAYOUT set) · aggregate derivable in JS from raw rows, but both cheap single-investment scans w/ own cache entries; folding couples consumers. Not worth it. (Matches the eager/lazy question raised pre-review — staying eager, keeping both.)
- [x] dismissed · code-review · `subcontractor-summary.tsx:100` (nameByWorker fallback) · benign — payoutTransactions & payouts share the same SQL predicate, so fallback only fires for the genuine null bucket.
- [x] dismissed · code-review · `reference-data.ts` (cache tags) · correct — both tagged transfers; worker-rename busts the users-tagged refData blob joined at the page, no stale-name hazard.
- [x] dismissed · code-review · share-path PII · no leak — payout queries return ids+amounts only (names at authenticated page); props default `[]`, never supplied on the client-view share plane.
- [x] dismissed · code-review · `page.tsx` Promise.all · clean — 404 rejection propagates, all fetches concurrent, no N+1.
- [x] dismissed · code-review · `build-transfer-filters.ts` worker filter · safe — `/^\d+$/`-guarded, real relationship field, non-numeric ignored by design.
- [x] dismissed · code-review · `getRowHref` undefined for null worker · correct — DataTableRow handles falsy href (no click, no crash).

### primitive-reuse-scan / simplify (complete)

- [x] fixed · reuse-scan · `page.tsx:79` + `subcontractor-summary.tsx:39` · null-worker label `'Bez przypisanego pracownika'` duplicated in two files (two sources of truth for one UI label) — hoisted to `UNASSIGNED_WORKER_NAME` in `lib/kosztorys/subcontractor-summary.ts`, imported by both. tsc + lint clean.
- [x] dismissed · reuse-scan · slice-wide · new code otherwise composes already-imported primitives (formatNet, formatPLDate, DataTable, ToggleGroup, summary-grid consts, computeSubcontractorSummary) — no hand-rolled dupes. PAYOUT SQL WHERE fragment repeats across sum-transfers.ts siblings but code-review already dropped folding (own cache entries, coupling not worth it).

## Simplify pass

Ran primitive-reuse-scan + comment-noise cleanup (folded into ## Findings) — 1 reuse dedup applied, 5 comment trims applied, dirty-file trims deferred. No separate report file (findings live in ## Findings).

## Tests & suite

- typecheck: `pnpm exec tsc --noEmit` — CLEAN (excluding the 1 pre-existing unrelated error in `src/scripts/seed-investment-from-sheet.ts:238`, a parallel agent's untracked file — not this slice).
- lint: `pnpm exec eslint` on the 6 touched files — CLEAN (no output).
- new integration test: `src/__tests__/lib/db/get-payout-transactions.test.ts` — GREEN (verified red on a weekday-first remap during authoring). Regression guard on the sortable-date invariant.
- Full suite (`typecheck && lint && test && test:e2e && build`) — NOT RUN, awaiting user go-ahead (per gate Step 3 pause).
- E2E: browser-level slice → owes an E2E for the wypłaty table/toggle. Not authored this pass; **owed** at close — author via `/10x-e2e` or file into `e2e-backlog`. OPEN.
