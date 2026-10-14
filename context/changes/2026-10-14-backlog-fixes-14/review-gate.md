# Review-gate ledger — backlog-fixes-14 (EX-1052, EX-1002, EX-1036, EX-1035, EX-983) · 2026-10-14

Scope: `d9be6fbd5^..98edfae20` + uncommitted `src/migrations/20261014_5_drop_kosztorys_worker_shares.ts`
and `src/migrations/index.ts`. Checks run: code-review, comment-noise-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit. Dropped: 10x-impl-review (no plan.md), tailwind-v4-audit
(no className change beyond re-indent), Step 0.5 browser pass (Playwright only on explicit ask —
manual checks stay with the human, `manual-checks.md` § 2026-10-14 — backlog-fixes-14).

## Findings

- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/actions/accept-worker-report.ts:68` · a save that
      only odrzuca lines still fires `kosztorysStages`/`stageProgress`/`kosztorysItems`/`investments`
      for every investment — skipped: the worker-report queue is an uncached server read, and these
      `updateTag`s are what re-render the editor's report list after the save; dropping them leaves a
      rejected report showing as pending. The gain is cold recomputes for ~40 users, not worth a
      behaviour change.
      test: no automated test — no defect; perf-only and not changed
- [x] fixed · code-review / structure-scatter-audit · `src/__tests__/components/kosztorys/editor/grid/*`,
      `src/__tests__/lib/kosztorys/worker-view/scope.test.ts` · EX-1035 left 22 specs spelling stages by
      hand (2 of them edited by this diff) — migrated onto `makeStage()`, green
- [x] dropped · code-review · `stage-header-{plane,completed}.test.tsx` · shared `makeStageOps()` helper
      for the two hand-written `OPS` objects — two consumers, six lines each; a helper adds nothing
- [x] dismissed · code-review · `context/foundation/manual-checks.md` (98edfae20) · the iPhone box of
      `worker-report-sticky-wobble` went in ticked — the tick was already in the working tree when the
      file was committed by pathspec (not my edit); whoever ticked it owns that sign-off. Flagged to the user.
- [x] dismissed · module-cohesion-audit · `kosztorys-v2-column-opts.ts:20` · move `StageOpsT` to the
      producing hook — the contract belongs to the receiver (column opts + `StageHeader`), like a
      `PropsT`; feature-first and scatter both judged the current home correct
- [x] dismissed · module-cohesion-audit · `use-tree-rewrite-action.ts:26` · reuse `settleTreeReplace` —
      different contract: no dialog to keep open, its own toast wording/duration, no `NOT_FOUND`
      refetch; folding it in would change what the user sees
- [x] fixed · comment-noise-audit · `kosztorys-v2-column-opts.ts:18` · trimmed the clause arguing
      against the five-handler shape that no longer exists
- [x] fixed · comment-noise-audit · `accept-worker-report.ts:120` · comment trimmed to the two reasons the
      fast path exists — no rozpiska read under the investment row lock (the `d9be6fbd5` rationale, which
      the first trim had wrongly cut) and no revision bump
- [x] fixed · comment-noise-audit · `src/__tests__/helpers/kosztorys-tree.ts:27` · history narration →
      `// Same reason as makeTree.`
- [x] fixed · comment-noise-audit · `settle-tree-replace.test.ts:17` · deleted — repeats the JSDoc at the source
- [x] dropped · structure-scatter-audit · `subcontractor-summary.test.{ts,tsx}` · two identical
      one-line `stage(id, workerId)` adapters — a shared helper for two specs is not a win
- [x] dismissed · feature-first-structure · all placements clean (StageOpsT, makeStage, migration `_5`)
- [x] fixed · simplify · `use-sheet-import.ts` / `kosztorys-editor-body.tsx:258` · `flushPendingSaves` was
      threaded to `SheetImportDialog` as a separate JSX prop beside the spread — now passed into
      `useSheetImport` and returned in `importDialogProps` with the rest of the dialog's contract
- [x] fixed · simplify · `use-kosztorys-stage-ops.ts` · five `handleXxxStage` functions existed only to be
      renamed into `stageOps` — the object is now built directly as `StageOpsT`
- [x] fixed · simplify · `use-worker-report-acceptance.ts:51` · a reject-only save still ran `patchRows`
      over every row and `pruneByIds([])` — both now skip when no cell moved; spec asserts it
- [x] fixed · simplify · `settle-tree-replace.test.ts`, `tree-rewrite-menu-items.test.tsx:75` · hand-rolled
      deferred → `Promise.withResolvers`
- [x] fixed · simplify · `column-color.test.ts:6,9` · unused `KosztorysStageT` import; single-use
      `stage()` adapter inlined
- [x] fixed · simplify · `stage-header-{completed,plane}.test.tsx` · spy aliases named after the removed
      props (`onSetPlane`, an unused `onSetSplit`) → assert on `OPS.setPlane` / `OPS.setCompleted`
- [x] dropped · simplify · `stage-value-headers.test.tsx:18` · positional `stage(id, ordinal, label)`
      adapter — six call sites, it shortens them; inlining is churn
- [x] dismissed · simplify · `accept-worker-report.ts:120` · delete the reject-only fast path — it keeps
      the rozpiska read out of the investment row lock (`d9be6fbd5`); not dead weight
- [x] skipped · simplify · `kosztorys-editor-v2.tsx` · move the versions drawer under the provider so it
      reads the flush from context — the shell placement is what lets it survive the body remount
- [x] skipped · simplify · `use-tree-rewrite-action.ts` · put `replaceTree` on the editor context —
      changes toast duration, wording and the `NOT_FOUND` refetch of the menu actions
- [x] dropped · simplify · `accept-worker-report.ts` · `flagAndSettle` helper — its params would equal its body
- [x] dropped · simplify · `accept-worker-report.ts` · merge the two `setLinesRejected` UPDATEs — two rows
      of a single report, not worth a CASE statement
- [x] dropped · simplify · `accept-worker-report.ts` · narrower tree read — reads one investment's
      rozpiska once per accept; no measurable cost
- [x] dropped · simplify · migrated grid specs · redundant `: KosztorysStageT` annotations — cosmetic

## Simplify pass

Ran /simplify — 6 applied, 0 proposed, 8 dismissed/skipped/dropped; each finding folded into

## Findings (tagged simplify). No separate report.

## Tests & suite

- `tsc --noEmit -p .` — 0 errors
- touched specs (`editor/grid/*`, `use-worker-report-acceptance`, `settle-tree-replace`,
  `tree-rewrite-menu-items`) — 40 files, 299 tests green
- full suite — deferred by user (pre-push runs the unit leg)
