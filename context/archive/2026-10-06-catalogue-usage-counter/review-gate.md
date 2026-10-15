# Review-gate ledger — catalogue-usage-counter (+ katalog/szablon poprawki) · 2026-10-08

Scope: `7eeca050a..810a43226` — 41f17bd0d, 886bc2c07, b3c1a9e52, e1f9a4162, 810a43226.

Fan-out: `/code-review`, `comment-noise-audit`, `feature-first-structure` / `module-cohesion-audit` /
`structure-scatter-audit`, `tailwind-v4-audit`. No `plan.md` → `/10x-impl-review` dropped out. No
verification pass.

## Findings

_Trimmed at archive (2026-10-15): `fixed` findings dropped — their record is the commit. Pre-trim tally: 15 fixed, 5 dropped, 7 dismissed, 2 skipped, 0 open._

- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/catalogue-usage.ts` · add `server-only` import — the only caller is the page behind `requireAuth`; hardening with no reachable leak
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/work-catalogue.tsx` · „Kosztorysy" and „Szablony" match a praca by different rules — deliberate: kosztorysy match by matchKey (pozycje copy text), szablony by `catalogue_item_id` (they reference the wpis)
- [x] 🔵 OBSERVATION · dismissed · code-review · deleted dom spec for the lazy count — the behaviour it covered was removed with it; nothing left unguarded
- [x] 🔵 OBSERVATION · dismissed · code-review · new condition ids persist in localStorage — `useEngagedIds` ignores unknown ids, a stale one falls through harmlessly
- [x] dropped · code-review · unrelated import reformat in a touched file — formatter churn, no behaviour
- [x] dropped · simplify · `createTestCatalogueEntry` test helper — the copies differ, and its params would mirror `payload.create`
- [x] dropped · simplify · `useOfferedFilterConditions` hook — two callers, nothing to share beyond the call
- [x] dropped · simplify · `src/app/(frontend)/katalog-prac/page.tsx:14` · sequential awaits — `getWorkCatalogue` is cached; usage needs its result anyway
- [x] skipped · simplify · ~440 KB `uncatalogued` hints in the page payload — lazy-loading the list is an architectural change; render cost already down to ~145 ms
- [x] skipped · simplify · generalise to „offer a filter only when its columns are on the surface" — needs a new `aboutColumns` field on every condition; review-worthy refactor, not a cleanup
- [x] dismissed · comment-noise · `src/components/ui/confirm-dialog.tsx:47` · carries the why (a `<p>` can't hold a `<ul>`)
- [x] dismissed · comment-noise · `src/lib/kosztorys/row-conditions/queries.ts:222-225`, `queries.test.ts:371-372` · flagged, kept — real rationale
- [x] dismissed · structure-scatter-audit · `context/foundation/manual-checks.md:2222` · historical „Policz użycia" box — a past section's record, not current truth
- [x] dismissed · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify — 8 applied, 2 skipped, 4 dropped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

Not run — awaiting user. Owed: typecheck (removed exports, new props), `presets.test.ts` (DB),
`catalogue-conditions.test.ts`, `build-catalogue-comparison.test.ts`, `catalogue-usage.test.ts`,
`uncatalogued-usage-list.test.tsx`, the kosztorys filter-menu specs over `offeredFilterConditions`.
Manual: 2 boxes added to `manual-checks.md` § „2026-10-08 — catalogue-usage-columns"; section open → slice stays in review.
