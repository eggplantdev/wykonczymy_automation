# Review-gate ledger — kosztorys-column-value-single-source (EX-894) · 2026-09-29

Scope: `6fb13641...kosztorys-column-value-single-source` (base = staging), 21 files, no untracked.
Step 0.5 skipped: browser pass not requested this turn; the one behaviour change (sort order in crew
views) is covered by the registry checks. tailwind-v4-audit dropped: no `className` in the diff.

Fan-out: `/10x-impl-review` (APPROVED — 0 critical, 2 warnings, 5 observations), `/code-review` (no
regressions; every figure identical to base), file-organization audits (1 finding), comment-noise
audit (flag-only).

## Findings

_Trimmed at archive (2026-09-29): 16 fixed findings dropped — each one's record is its commit. Pre-trim tally: 16 fixed, 3 dismissed, 3 dropped, 1 skipped · 0 open._

- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `column-value-parity.test.ts:81` · parity spec checks routing, not values — that is its job (catches a computed column with an inline `compute` that the sort would miss); its header claims routing only, values are pinned by the literal-value specs
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/sort-value.ts:25` · `sortValueGetter` never passes `executedQtyByItem`, so a `remainingForPlane` sort would not sort — unreachable: the worker grid mounts in `preview`, `onSetSort` is undefined; base had the same gap
      test: no automated test · unit — not reachable
- [x] dropped · code-review · `kosztorys-v2-columns.tsx:316` · `?? 0` in `overrunTone` on a value never `null` for those ids — cosmetic, keeps `ColumnValueT` honest
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
