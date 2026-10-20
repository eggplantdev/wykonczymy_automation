# Review-gate ledger — kosztorys-commit-on-settle (EX-1116) · 2026-10-20

Scope: `c7c47299f...HEAD` (spike `dc612530e` + p1 `372b8ad7d` + p2 `352e73365`). Checks: impl-review,
code-review, comment-noise-audit. Dropped: tailwind (no class changes), feature-first / scatter (no
new `src` files), verify pass (owner vibe check on the preview passed; boxes stay in manual-checks).

## Findings

- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `src/components/kosztorys/editor/hooks/use-debounced-save.ts:32` · an edit settled by a click on a link was lost: unmount cleared the pending 500 ms save — unmount now `flush()`es pending saves (`save-lanes.ts`); a restore-remount fires them too, which is a save instead of a silent drop
      test: test-driven-debugging · integration — renderHook: save → unmount → action called (red → green)
- [x] 🟡 WARNING · fixed · impl-review · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:32` · the over-ceiling sentence no longer showed while typing, and a stale flag stayed up under a draft below the ceiling — `cellKeystroke` carries `warning`, the hook keeps the live `verdict`, price/coeff cells show the draft's verdict while drafting
      test: test-driven-debugging · unit + dom — the existing „bez najeżdżania myszą" spec back to green, plus a new stale-flag spec (override 90, type 60 → no sentence)
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:72` · the worker report szkic was no longer saved when a phone backgrounded the page mid-entry (no blur) — the draft settles on `visibilitychange` → hidden
      test: test-driven-debugging · dom — `decimal-cell.test.tsx` „commits the draft when the phone sends the page to the background" (red → green)
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` EX-1116 · the Rabat check promised a live red message the discount cell never shows — clause dropped
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` Progress 1.1/1.2 unticked — ticked with `372b8ad7d` after the green run below
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/editor/grid/cells/current-planned-qty-cell.tsx:28` · a typed draft rendered in the grey „derived" tone — tone only when not drafting (also the price cell)
      test: no automated test — cosmetic tone
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts` · no `cellSettle` spec for the coefficient policy — commit / negative-reject / clear added
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/kosztorys/cell-edit.ts` · `commit`→`accept` rename and `NumericFieldPolicyT.read` drift from the plan's contract — implementation-level naming, nothing a later phase depends on
- [x] fixed · impl-review + code-review · `src/__tests__/lib/kosztorys/cell-edit.test.ts:93` · literal NBSP — ` ` escape restored
- [x] fixed · impl-review + code-review · `scripts/perf/keystroke-ab.js:36` · a throwing series left the perf cell at 123456789 and `restored` was never compared — restore in `finally`, throw on mismatch
- [x] dismissed · code-review · `scripts/perf/keystroke-ab.js:5` · hardcoded preview URL — the doc tells you to edit it; one-off harness
- [x] dismissed · code-review · `foldRetractions` merges real there-and-back edits — kept on purpose for Escape in long-text cells (plan)
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts:40` · stale „The bug this guards…" comment deleted
- [x] fixed · comment-noise · `scripts/perf/keystroke-ab.js:12` · wrong claim about x positions deleted
- [x] fixed · comment-noise · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:15` · JSDoc trimmed to one line
- [x] fixed · comment-noise · `src/components/kosztorys/editor/grid/cells/decimal-column.tsx:13` · trailing clause dropped
- [x] fixed · comment-noise · `src/__tests__/components/kosztorys/editor/grid/cells/subcontractor-price-edit.test.tsx:123` · duplicate of the hook's virtualization comment deleted
- [x] fixed · simplify · `src/lib/kosztorys/cell-edit.ts:7` · `restoredLabel` was required, so `numericFieldPolicy` took a `format` and `currentPlannedQtyPolicy` built a label no unguarded cell can ever show — optional now, both dropped
- [x] fixed · simplify · `src/lib/kosztorys/cell-edit.ts:12` · `accept`/`blocked` + `warning` re-encoded the guard's verdict — keystroke returns `value` with the `CellVerdictT` as is
- [x] fixed · simplify + altitude · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:73` · `verdict` kept in state (stale if the row changed mid-draft) and both subcontractor cells repeated `drafting ? verdict : checkSubcontractorPrice` — the hook derives it at render, the guard's verdict when not drafting; edit state is the draft string
- [x] fixed · efficiency + altitude · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:63` · one `visibilitychange` listener per visible numeric cell — attached only while that cell drafts
- [x] fixed · efficiency · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:30` · `closeDraft` set state on every blur with no draft — early return
- [x] fixed · altitude · `src/components/kosztorys/editor/hooks/use-restore-remount.ts:12` · comment still said the remount drops the debounced edit; unmount now flushes it
- [x] skipped · altitude · `src/components/kosztorys/editor/hooks/use-debounced-save.ts` · settle on hide still leaves the write in the 500 ms debounce; a body-level hide → blur + `flush()` would close it — same gap every debounced write (text cells, stage fields) had before this slice; needs the settle and the flush ordered across listeners, unverified
- [x] dismissed · altitude · `useReportDraft` writes the szkic in an effect, not in `setQty` — the page-hidden DOM spec asserts the szkic is stored
- [x] dropped · efficiency · `discount-columns.tsx` / subcontractor cells rebuild their policy object per render — a few allocations per visible cell
- [x] dropped · efficiency · four further per-render micro-costs — negligible next to the per-keystroke editor re-run this slice removed
- [x] dropped · reuse · `useEffectEvent` instead of the `settleRef` pattern — a repo-wide convention change
- [x] dropped · reuse · call `drainAll` on unmount instead of exporting `flush` — `drainAll` is the awaited variant; same work
- [x] dropped · simplify · fold `clear` into `commit` — the separate kind names the „empty means reset" rule

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 7 applied, 0 proposed, 1 skipped, 1 dismissed, 5 dropped; each folded into ## Findings (tagged simplify / efficiency / altitude / reuse). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.JtuLyUjKDT.md`.

## Tests & suite

- `pnpm typecheck` — green (worktree needed the generated `payload-types.ts` / `importMap.js` copied in).
- `pnpm exec eslint` on kosztorys components, lib and specs — green.
- `vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys` — 255 files passed, 18 skipped (DB); 2505 tests passed.
- Full `pnpm test` / E2E — not run (kosztorys specs cover the diff; E2E not requested).
