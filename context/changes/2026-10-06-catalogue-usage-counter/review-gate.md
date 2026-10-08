# Review-gate ledger — catalogue-usage-counter (+ katalog/szablon poprawki) · 2026-10-08

Scope: `7eeca050a..810a43226` — 41f17bd0d, 886bc2c07, b3c1a9e52, e1f9a4162, 810a43226.

Fan-out: `/code-review`, `comment-noise-audit`, `feature-first-structure` / `module-cohesion-audit` /
`structure-scatter-audit`, `tailwind-v4-audit`. No `plan.md` → `/10x-impl-review` dropped out. No
verification pass.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/lib/db/presets.ts` · the per-szablon count had no DB spec — the dedup (DISTINCT inwestycja across sekcje) and the trashed-szablon exclusion were unguarded — spec added to `presets.test.ts` for the replacing `listTemplateNamesByCatalogueItem`
      test: TDD · integration — live szablon with the praca in 2 sekcje + trashed szablon + plain kosztorys → exactly `[live name]`; not run yet (see Tests)
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts:117` · comment still described the removed lazy „Policz użycia" pass — removed
- [x] 🟡 WARNING · fixed · code-review · `context/reference/kosztorys-editor-domain-notes.md:1539` · heading/section still named the lazy count — renamed „Katalog prac: Filtry, Problemy i kolumny użycia", „Kolumna „Kosztorysy" — co znaczy „używana""
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/work-catalogue/types.ts:202` · comment wording on the props-boundary shape — now „Plain records and arrays only: it crosses the server → client props boundary."
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/catalogue-usage.ts` · add `server-only` import — the only caller is the page behind `requireAuth`; hardening with no reachable leak
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/work-catalogue.tsx` · „Kosztorysy" and „Szablony" match a praca by different rules — deliberate: kosztorysy match by matchKey (pozycje copy text), szablony by `catalogue_item_id` (they reference the wpis)
- [x] 🔵 OBSERVATION · dismissed · code-review · deleted dom spec for the lazy count — the behaviour it covered was removed with it; nothing left unguarded
- [x] 🔵 OBSERVATION · dismissed · code-review · new condition ids persist in localStorage — `useEngagedIds` ignores unknown ids, a stale one falls through harmlessly
- [x] dropped · code-review · unrelated import reformat in a touched file — formatter churn, no behaviour
- [x] fixed · simplify · `src/lib/utils/string-similarity.ts` · near-duplicate/hint scoring took ~1 s per `buildCatalogueUsage` (now on every /katalog-prac open) — bigrams packed into a sorted `Uint32Array` + merge-intersection Dice; ~145 ms, byte-identical output on the local DB
- [x] fixed · simplify · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts` · `closestEntries` built a hint object for every candidate — scores first, builds only the survivors
- [x] fixed · simplify · `src/lib/db/presets.ts` · count query + lazy hook + server action for szablon names were three paths to one fact — one bulk `listTemplateNamesByCatalogueItem` (names; length = count) feeds column, filters and both dialogs; `use-catalogue-item-templates.ts` and `catalogue-template-usage.ts` deleted. Cross-checked against the per-item query: 301 prace, 0 mismatches
- [x] fixed · simplify · `src/lib/kosztorys/work-catalogue/types.ts` · template counts travelled as a separate prop beside `usage` — folded into `CatalogueUsageT.templateNamesById`
- [x] fixed · simplify · `src/components/tables/work-catalogue.tsx` · two near-identical count columns — one `countColumn`
- [x] fixed · simplify · `src/lib/kosztorys/row-conditions/queries.ts` · hard-coded `TEMPLATE_FILTER_GROUPS` allowlist duplicated what `revealsColumns` already says — workbench gate derived from `WORKSHOP_VISIBLE_COLUMNS`; constant deleted
- [x] fixed · simplify · `src/__tests__/lib/db/presets-template-counts.db.test.ts` · a new spec file for one query of `presets.ts` — moved into `presets.test.ts`
- [x] dropped · simplify · `createTestCatalogueEntry` test helper — the copies differ, and its params would mirror `payload.create`
- [x] dropped · simplify · `useOfferedFilterConditions` hook — two callers, nothing to share beyond the call
- [x] dropped · simplify · `src/app/(frontend)/katalog-prac/page.tsx:14` · sequential awaits — `getWorkCatalogue` is cached; usage needs its result anyway
- [x] skipped · simplify · ~440 KB `uncatalogued` hints in the page payload — lazy-loading the list is an architectural change; render cost already down to ~145 ms
- [x] skipped · simplify · generalise to „offer a filter only when its columns are on the surface" — needs a new `aboutColumns` field on every condition; review-worthy refactor, not a cleanup
- [x] fixed · comment-noise · `src/lib/kosztorys/filter-groups.ts`, `src/lib/db/presets.ts`, `catalogue-conditions.ts` (×2), `types.ts` · restating / vanished-state comments — removed or trimmed
- [x] fixed · comment-noise · `src/lib/queries/catalogue-usage.ts` · JSDoc narrated the change — now the why: uncached, ~0.1 s, a cached count would expire on every kosztorys save
- [x] fixed · comment-noise · `src/__tests__/lib/db/catalogue-usage.db.test.ts` · header reflow
- [x] dismissed · comment-noise · `src/components/ui/confirm-dialog.tsx:47` · carries the why (a `<p>` can't hold a `<ul>`)
- [x] dismissed · comment-noise · `src/lib/kosztorys/row-conditions/queries.ts:222-225`, `queries.test.ts:371-372` · flagged, kept — real rationale
- [x] fixed · module-cohesion-audit · `catalogue-conditions.ts` · `catalogueUsageConditions` took the two counts in different shapes — one `usagePair` + `CatalogueUsageT`
- [x] dismissed · structure-scatter-audit · `context/foundation/manual-checks.md:2222` · historical „Policz użycia" box — a past section's record, not current truth
- [x] dismissed · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify — 8 applied, 2 skipped, 4 dropped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

Not run — awaiting user. Owed: typecheck (removed exports, new props), `presets.test.ts` (DB),
`catalogue-conditions.test.ts`, `build-catalogue-comparison.test.ts`, `catalogue-usage.test.ts`,
`uncatalogued-usage-list.test.tsx`, the kosztorys filter-menu specs over `offeredFilterConditions`.
Manual: 2 boxes added to `manual-checks.md` § „2026-10-08 — catalogue-usage-columns"; section open → slice stays in review.
