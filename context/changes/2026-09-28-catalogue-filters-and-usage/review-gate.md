# Review-gate ledger — catalogue-filters-and-usage (EX-863, EX-873) · 2026-09-29

Scope: commits f5e05c0e, 2086fa3b, 51c181ab, 9c21694b, b6b1dd1b, 6476ebd3, 2c6109a5, 05c15957 (base `3943cf21`, 42 files; foreign commits in range: 0d3b703d, 51fdf11b, 1b41c1d7, 4c3ee036).
Step 0.5 (browser verification) skipped — no Playwright unprompted; manual checks stay in
`context/foundation/manual-checks.md` § catalogue-filters-and-usage.

Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only).

## Findings

- [x] 🟡 WARNING · fixed · code-review + impl-review (F1) · `src/components/work-catalogue/work-catalogue-data-table.tsx:69` · a usage count taken before the cennik changed kept showing — a praca added since read as „0" and matched „nieużywane", exactly what a pruning owner deletes — the count and the engaged Użycie filters are now dropped on a new `data` identity (render-time reset, no effect)
      test: test-driven-debugging · unit (dom) — `work-catalogue-data-table.test.tsx`, red without the reset, green with it
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/work-catalogue/catalogue-near-duplicates.ts:62` · `sameWord` measured the shared prefix against the SHORTER word, so „podłogi" matched „podłączenia" on four letters — now measured on the longer word
      test: TDD · unit — pair added to the „does not read a shared first syllable" case, red before the fix
- [x] 🟡 WARNING · fixed · code-review · `src/lib/db/catalogue-usage.ts:17` · a pozycja with a blank opis (description is not required) grouped into an uncatalogued „" row — filtered in SQL
      test: TDD · integration — `catalogue-usage.db.test.ts` „skips a pozycja without an opis" (5435)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/work-catalogue/catalogue-near-duplicates.ts:97` · bucket fill re-spread the array per wpis — plain push
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/work-catalogue/work-catalogue-data-table.tsx:130` · condition counts not memoised — React Compiler memoises them
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/catalogue-usage.ts:14` · a read wrapped in `protectedAction` — the established pattern for on-demand `'use server'` reads (`register-balance.ts`), and it triggers no revalidation
- [x] 🟡 WARNING · dismissed · impl-review (F2) · `plan.md` · plan text vs role list drift — the role lists are identical
- [x] 🔵 OBSERVATION · dismissed · impl-review (F4) · benign on re-read
- [x] 🔵 OBSERVATION · skipped · impl-review (F3) · the problems-menu / data-table wiring has no split spec — the stale-usage DOM spec now renders the whole table; the rest is a manual check (§ catalogue-filters-and-usage), not worth a second harness
- [x] fixed · code-review (CR6) · `src/lib/utils/capitalize.ts` · three copies of first-letter capitalisation (catalogue filters model, editor filters model, `clean-description`) — one helper
- [x] fixed · module-cohesion-audit (MC1) · `src/lib/kosztorys/work-catalogue/hint-lead.ts` · `hintLead` (a pure sentence rule) lived in a component file and was imported by two others — moved to lib
- [x] dropped · code-review (CR7) · `src/lib/kosztorys/work-catalogue/category-options.ts` · kategoria / j.m. option builders are twins — two uses, a shared generic would be as long as both
- [x] dropped · code-review (CR8) · `src/lib/kosztorys/work-catalogue/catalogue-usage.ts:64` · second grouping pass for „inna j.m." — a clear two-step, merging it saves nothing
- [x] dropped · simplify (primitive-reuse-scan) · `src/components/work-catalogue/catalogue-problems-menu-model.ts` · twin of the editor's `problemsMenuModel` — the shared core is two chained lines over different condition types; a helper's params would equal the code
- [x] skipped · module-cohesion-audit (MC2) · `src/components/work-catalogue/work-catalogue-data-table.tsx:54` · extract the Użycie-engagement state into a hook — one consumer, and this component is the page's composition root; revisit if a second surface counts usage
- [x] dismissed · module-cohesion-audit (MC3–5) · no action — cohesive as written
- [x] dismissed · tailwind-v4-audit · palette colour on moved code — not authored in this slice
- [x] dismissed · feature-first-structure · clean
- [x] dismissed · structure-scatter-audit · clean — new files landed in existing homes
- [x] fixed · comment-noise-audit · `src/components/work-catalogue/catalogue-problems-menu.tsx:21` · prop comment restated the handler — deleted
- [x] fixed · comment-noise-audit · `src/components/work-catalogue/count-usage-button.tsx:10` · „Clicking again recounts." restated the button — cut
- [x] fixed · comment-noise-audit · `src/__tests__/lib/kosztorys/work-catalogue/catalogue-rate.test.ts:98` · three Polish code comments — translated to English
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts` · vanished-state comment („opened every row until 2026-09-28") orphaned by the capitalize move — rewritten as the why, beside the label it explains
- [x] dismissed · comment-noise-audit · `src/components/tables/work-catalogue.tsx:120` · kept — carries why „inna j.m." is not counted into „Kosztorysy"
- [x] dismissed · comment-noise-audit · `src/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row.tsx` · kept — why j.m. and cena sit in columns

## Simplify pass

Ran the simplify pass in the main thread over the triaged findings — 10 applied, 0 proposed, 3 dropped; every finding folded into ## Findings (tagged by source).

## Tests & suite

- Touched specs: catalogue dialogs + work-catalogue components + `lib/kosztorys/work-catalogue` — 187 passed; DB spec vs 5435 — 6/6; editor toolbar menus — green.
- `pnpm typecheck` — clean. ESLint on touched files — clean.
- Unrelated red seen: `kosztorys-editor-toolbar.test.tsx` (3 tests, `KosztorysAddMenu` reads an unset `sections`) — from 2cee8858 (kosztorys-empty-section), not this slice.
- Full suite / E2E — not run (never unasked).
- E2E disposition: the slice is client-side filtering over one page plus one read; its browser risks (count → filter → reset) are covered by the DOM spec and the manual checks — no Playwright spec owed.
