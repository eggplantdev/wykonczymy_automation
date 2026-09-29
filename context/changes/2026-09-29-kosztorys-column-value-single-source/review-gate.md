# Review-gate ledger — kosztorys-column-value-single-source (EX-894) · 2026-09-29

Scope: `6fb13641...kosztorys-column-value-single-source` (base = staging), 21 files, no untracked.
Step 0.5 skipped: browser pass not requested this turn; the one behaviour change (sort order in crew
views) is covered by the registry checks. tailwind-v4-audit dropped: no `className` in the diff.

Fan-out: `/10x-impl-review` (APPROVED — 0 critical, 2 warnings, 5 observations), `/code-review` (no
regressions; every figure identical to base), file-organization audits (1 finding), comment-noise
audit (flag-only).

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/kosztorys/column-totals.test.ts:204` · totals parity spec was green by construction for 6 of 7 legs (rebuilt `sumOf` on the same resolver) — cut to the one independent leg (etap axis vs its cells, 3 views), plus a concrete non-zero rabat total
      test: TDD · unit — the rabat total is pinned as a literal (8 / 8×1.08), not re-derived
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/kosztorys/column-totals.ts:50` · totals read the lenient resolver, so a mistyped id summed to 0 zł silently — now `computedColumnValues`, which throws like the grid and prints
      test: no automated test · unit — unreachable today (every id is fixed); the throw itself is the guard, and the column-totals specs exercise every id
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md:377` · Progress 4.1 unticked, phase-4 contract choice recorded only in the commit — ticked `— 833942da` + phase-4 note in the epilogue commit
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/kosztorys/sort-value.ts:72` · `columnSortValue` had no production caller and rebuilt the resolver per call — deleted; specs call `sortValueGetter(field, view, stages)(row)` via a local `sortKey`
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `column-value-parity.test.ts:81` · parity spec checks routing, not values — that is its job (catches a computed column with an inline `compute` that the sort would miss); its header claims routing only, values are pinned by the literal-value specs
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/column-values.ts:63` · `remaining` recomputed client Σ etapów 4× per row (2 cells + 2 overrun tones) — memoised with `memoisedByRow`; `donePercent` moved beside the owner-ruling comment as a named const
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/sort-value.ts:25` · `sortValueGetter` never passes `executedQtyByItem`, so a `remainingForPlane` sort would not sort — unreachable: the worker grid mounts in `preview`, `onSetSort` is undefined; base had the same gap
      test: no automated test · unit — not reachable
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/stage-keys.ts:36`, `src/lib/kosztorys/calc.ts:165` · stale comments naming `sort-value.ts` / `columnSortValue` — now `column-values.ts` / `sortValueGetter`
- [x] dropped · code-review · `kosztorys-v2-columns.tsx:316` · `?? 0` in `overrunTone` on a value never `null` for those ids — cosmetic, keeps `ColumnValueT` honest
- [x] fixed · impl-review F7 + file-organization · `src/lib/kosztorys/print/columns.ts:20` · `PrintValuesT` restated the strict getter's type — one `ColumnValuesT` exported from `column-values.ts`, used by `computedColumnValues` and `stageNetColumns`; the `formattedValue` null comment (restated the code) deleted
- [x] fixed · comment-noise · `column-values.ts` · deleted 3 restating comments („An etap that is gone…", „Rabat is taken on the same pomiar…", „The per-etap namespaces carry…")
- [x] fixed · comment-noise · `column-values.ts:39`, `sort-value.ts:14,29`, `kosztorys-v2-columns.tsx:139`, `offer-columns.ts:33` · trimmed vanished-state / restating clauses (ticket history, „now that…", a second sentence repeating the module doc); offer-plane comment cut to its one reason
- [x] fixed · comment-noise · `column-values.ts:32` · „the cell renders a dash" was grid-only — prints leave the cell blank; reworded surface-neutral
<!-- simplify findings folded in below -->
- [x] fixed · simplify · `src/lib/kosztorys/column-values.ts:52` · `grossOf` was null-blind, so the gross stage branch re-wrapped the net getter by hand — `grossOf` is null-aware and the branch reads `grossOf(stageValueNet(id))`
- [x] fixed · simplify · `src/lib/kosztorys/column-values.ts:62`, `settlement-rows.ts` · client Σ etapów computed twice per row (`remaining` via `rowRemainingForView`, `donePercent` directly) — one memoised `clientQtyDone` feeds both; `rowRemainingForView` deleted, its rationale merged into `rowRemainingForExecutedQty`
- [x] fixed · simplify · `src/lib/kosztorys/settlement-aggregates.ts:86` · `sectionSubtotalsForView` re-derived net / rabat / wartość przedmiaru from calc.ts — reads `computedColumnValues` now, so section subtotals are the same figures as the cells and column totals
- [x] fixed · simplify · `kosztorys-v2-columns.tsx:139` · `resolvedColumn` took a title every call site derived the same way — derives `columnTitle(id, opts)` itself; 13 call sites shortened
- [x] fixed · simplify · `src/lib/kosztorys/print/columns.ts` · offer and worker prints each repeated `moneyColumn(key, label, formattedValue(valueOf(key), fmt))` — one `computedMoneyColumn(valueOf, fmt)` factory
- [x] fixed · simplify · `kosztorys-sort-value.test.ts`, `column-value-parity.test.ts` · local `sortKey` wrappers re-wrapped `sortValueGetter` — specs pass the getter straight in; parity loop extracted to `expectCellsMatchSort`
- [x] skipped · simplify · `kosztorys-v2-columns.tsx` · route price / priceCoeff / divergence through the resolver — those are editable columns, outside EX-894's computed-column contract, and already share calc.ts helpers
- [x] dismissed · simplify · `src/lib/kosztorys/column-totals.ts` · loop the lenient resolver instead of the strict one — would undo the F2 fix; the guard is two lines
- [x] dropped · simplify · `column-values.ts:21` · un-export `ColumnValueCtxT` — cosmetic, no churn worth it
- [x] dropped · simplify · `column-totals.ts`, `sort-value.ts`, `column-values.ts` · one-shot memos in totals/sort, `donePercent` unmemoised, optional `useMemo` around the resolver — no profile evidence; the grid path is already memoised per row

## Simplify pass

Ran /simplify — 6 applied, 0 proposed, 1 skipped, 1 dismissed, 2 dropped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck (`tsc --noEmit`) — clean
- eslint on the changed files — clean
- `pnpm test` (unit, node + dom) — 4322 passed, 1 failed: `resolve-id.test.ts` „CACHE_TAGS values follow collection: prefix pattern", which is pre-existing and fails on the staging base `6fb13641` too; unrelated
- integration / build — deferred by the user (the pre-push hook gates them); e2e not run
