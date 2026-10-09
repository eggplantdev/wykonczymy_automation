# Review-gate ledger — worker-report-review-table · 2026-10-06

Scope: `75192f52..37cc8901` (`6b373904` dialog-2xl token, `37cc8901` review dialog: search, column menu,
„Opis w języku pracownika”, „Zgłoszone prace” button). Ad-hoc session work, no plan.md.
Checks: code-review, tailwind-v4-audit, comment-noise-audit (flag-only), feature-first-structure +
module-cohesion-audit + structure-scatter-audit. Skipped: 10x-impl-review (no plan), Step 0.5 browser
pass (Playwright not authorised this turn).

_Trimmed at archive (2026-10-09): 5 of 16 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on._

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `review-lines-table.tsx` workerDescriptionColumn · hideable column is the only place the worker's original wording shows — hiding is the owner's choice; the column menu was asked for exactly this
      test: no automated test — product decision, not a defect
- [x] 🔵 OBSERVATION · dismissed · code-review · `review-lines-table.tsx` acceptedColumn · „Przyjmuję” is hideable — `enableHiding: false` would also pin it to the front (DataTable couples the two), which broke the order once already; viewer's own choice
      test: no automated test — product decision
- [x] 🔵 OBSERVATION · dismissed · code-review · `worker-report-review.tsx` reviewRows · search text re-folded on every draft edit — tens of rows, sub-millisecond (efficiency agent agrees)
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · code-review · `worker-report-review.tsx` workerDescriptionOf · rozpiska uses the worker's current account language — by design: the column answers what he reads now
      test: no automated test — intended behaviour
- [x] dropped · code-review · `lib/db/worker-reports.ts:89` · long REPORT_COLUMNS line — the line below it was already longer; cosmetic
- [x] dropped · reuse-scan · `ui/column-toggle-menu.tsx:70` · `contentClassName` replaces the `w-72` default instead of merging — moot once the only caller repeating it was removed
- [x] dismissed · altitude · `tables/data-table/data-table.tsx:123` · non-hideable ⇒ pinned-first coupling — both users are first anyway; documented in place
- [x] dismissed · altitude · `globals.css` + `cn.ts` · new dialog token needs two edits — documented cost of a closed set
- [x] dismissed · tailwind-v4-audit · nothing found
- [x] dismissed · feature-first / module-cohesion / structure-scatter · nothing found; review-lines-table.tsx at 603 lines but one reason to change
- [x] dropped · e2e · search + column menu inside one dialog — cosmetic UI gestures, covered by the manual-checks section

## Simplify pass

Ran /simplify (4 agents + primitive-reuse-scan) — 3 applied (z-index into primitives, derived search state, workerDescriptionOf), 2 dropped, 2 dismissed; folded into ## Findings. No separate report file.

## Tests & suite

- tsc --noEmit: green
- eslint on touched files: green
- vitest src/**tests**/components/kosztorys/editor/dialogs + components/ui + components/filters: 23 files / 137 tests green
- full suite / e2e: not run (not asked)
