# Review-gate ledger — worker-pdf-own-work-filter · 2026-10-22

Scope: uncommitted working tree on `staging`, base `HEAD` (f6ecaa522), this slice's paths only.
Step 0.5 (browser verification) skipped — the user verifies locally on a fresh prod dump.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/lib/kosztorys/print/worker.ts:124` · unticked totals over `documentRows` instead of all rows could drop a hidden row's negative „Pozostało" — false positive: `columnTotalsForRows` already excludes overruns (`notOverrun`, `column-totals.ts:53`), and every other money column is 0 on a row empty on both axes
      test: no automated test — no behaviour change; `'hides an empty pozycja without moving a total'` already pins hidden vs shown totals
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/kosztorys/print/worker.test.ts:377-413` · two absence-only specs had no positive control — unticked controls from the same fixture added
      test: TDD · unit — the spec itself is the guard
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` · plan didn't record three deliberate deviations — `## Deviations (as built)` added
- [x] 🔵 OBSERVATION · fixed · impl-review · `worker.test.ts` · planned shared-etap case missing — `'keeps a pozycja whose work sits in an etap he shares'` added
      test: TDD · unit — added
- [x] 🔵 OBSERVATION · dismissed · impl-review · `use-worker-actions.ts:59` · checkbox state in the shared actions context — kept (Fix A): mirrors `requestShare`'s reset-on-request, no effect hook, no second component; recorded in plan Deviations
- [x] 🔵 OBSERVATION · skipped · code-review · `worker.ts:122` · `> 0` drops a pozycja whose only entry is a negative correction — matches the repo's existing „z wykonaną pracą" predicate (`registry.ts:200`, `protocolScopeRows`); revisit only if negative entries show up
      test: no automated test — reachability unconfirmed
- [x] fixed · feature-first-structure / module-cohesion / structure-scatter / code-review · `actions/worker-print-action.tsx:18` · `useWorkerPrint` hook lived in a menu-item component file — moved to `actions/use-worker-print.ts`
- [x] fixed · feature-first-structure / impl-review / code-review · `dialogs/worker-print-dialog.tsx` · file name didn't match `KosztorysWorkerPrintDialog` — renamed to `dialogs/kosztorys-worker-print-dialog.tsx`
- [x] fixed · module-cohesion · `use-worker-actions.ts`, `worker-print-action.tsx`, `worker-actions.tsx:15` · six copies of `Pick<WorkerShareTargetT, 'id' | 'name'>` — `WorkerTargetT` base type, `WorkerShareTargetT` extends it
- [x] dismissed · structure-scatter · `dialogs/` · root vs one-file subfolder homes for single-file dialogs — pre-existing mix, the new file follows the root convention
- [x] dismissed · comment-noise-audit · — · clean
- [x] dismissed · tailwind-v4-audit · — · clean
- [x] fixed · simplify (reuse + altitude) · `src/lib/kosztorys/print/worker.ts:120` · inline `rowTotalQtyDone(…) > 0` filter re-defined the registry's „z wykonaną pracą" — `documentRows(…, executedOnly)` now engages `HAS_MEASURED_QTY_CONDITION_ID` (new constant in `registry.ts`)
- [x] fixed · simplify · `worker.test.ts` own-work describe · `html(projection(offerColumns, [], tree), bool)` repeated nine times — local `printed(tree, ownWorkOnly = true)`
- [x] fixed · simplify · `kosztorys-workers-menu.test.tsx` „the PDF" · open-menu → click → find-dialog and the „Drukuj" click repeated, with two different dialog-name regexes — `openPrintDialog()` / `printFrom(dialog)`
- [x] fixed · simplify · `kosztorys-worker-print-dialog.tsx:37` · `disabled={!target}` unreachable behind `print()`'s early return — dropped
- [x] dismissed · simplify · `worker.ts` `buildWorkerPrintHtml` · default `ownWorkOnly = false` — required on purpose: every caller decides; the form builder doesn't take it
- [x] dismissed · simplify · `kosztorys-worker-print-dialog.tsx` · use `FormDialogShell` — adds „Anuluj" and restyles; sibling `kosztorys-worker-view-dialog.tsx` uses the same single-button footer
- [x] dismissed · simplify · efficiency · — · clean

## Simplify pass

Ran /simplify — 4 applied, 0 proposed, 3 dismissed; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- vitest — `worker.test.ts`, `worker-form.test.ts`, `kosztorys-workers-menu.test.tsx`, `row-conditions/{registry,queries}.test.ts`: 5 files, 181 tests passed
- `pnpm typecheck` — slice clean; the only 6 errors are in another session's `context/changes/2026-10-22-catalogue-alias-mapping/alias-list.ts`
- eslint over the slice's files — clean
- full `pnpm test` / E2E — not run (not asked)
