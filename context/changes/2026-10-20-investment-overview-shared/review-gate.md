# Review-gate ledger — investment-overview-shared · 2026-10-20

Scope: `ae2ab8208...HEAD` on branch `investment-overview-shared` (p1–p5 + epilogue). Browser verification pass
skipped (no browser unless asked in the turn); manual checks stay open in `context/foundation/manual-checks.md`.

## Findings

- [ ] 🟡 WARNING · proposed · impl-review + code-review · `src/app/(frontend)/layout.tsx:78` · reference data and order settings now come from the layout, which a soft navigation does not re-render — another manager's write (new investment, worker, cash register, supplier) shows up only after a reload or the viewer's own revalidating action; e.g. `/kosztorysy` „bez kosztorysu" (page data) and the AddSheet picker (layout data) can disagree — needs the owner's call: accept + document, or refresh on dialog open
      test: no automated test · e2e — two sessions; the manual check is the realistic guard
- [ ] 🔵 OBSERVATION · proposed · code-review · `src/components/investments/investment-overview.tsx:91` · „Zdjęcia i pliki" stays writable for an investment in the Kosz, and `src/lib/actions/investment-assets.ts:17` has no trashed check — predates the slice but contradicts the block's read-only contract; changes what a user may do, so it waits for the owner's call
      test: TDD · unit — DOM assertion in `investment-overview.test.tsx` alongside the fix
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/hooks/use-reference-data.tsx:35` · `useReferenceData` built a new object on every call (the compiler skips a function that calls only `use`), so `TransferDataTable` rebuilt every column on each render — hand `useMemo`, the compiled output now caches it
      test: test-driven-debugging · unit — `src/__tests__/hooks/use-reference-data-memoization.test.tsx` red without the memo, green with it
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:133` · `trashed` reached the „Inwestycja" tab only through the `...panelData` rest spread — now destructured and passed explicitly
      test: TDD · unit — `summary-panel-content.test.tsx` „jest tylko do odczytu dla inwestycji w Koszu"
- [x] fixed · impl-review · 16 diff files · Prettier not applied — formatted every diff file whose base was clean (`expense-drafts-data-table.tsx` left alone: unformatted before the slice)
- [x] dismissed · impl-review · `top-nav.tsx`, `investment-data-table.tsx`, `leads-data-table.tsx`, `kosztorys-data-table.tsx`, `transfer-data-table.tsx` · hook read at table/nav level, not at dialog depth — measured in research.md „Load timings (after)": no regression
- [x] dropped · impl-review · `src/components/sheets/kosztorys-data-table.tsx:23` · „bez kosztorysu" filter duplicated with `src/app/(frontend)/kosztorysy/page.tsx:20` — a helper would take the code as its params; `/kosztorysy` is deprecated
- [x] fixed · comment-noise · `src/__tests__/stubs/use-reference-data.ts:5` · comment restated the stub — deleted
- [x] fixed · comment-noise · `src/components/investments/investment-overview.tsx:25` · comment on `assets?` restated the type — deleted
- [x] fixed · comment-noise · `src/hooks/use-reference-data.tsx:18` · provider comment trimmed to the one sentence that names what breaks
- [x] dismissed · comment-noise · `src/hooks/use-reference-data.tsx:33` · „`null` outside the provider" comment kept — names the share-route/EMPLOYEE callers that break without the null path
- [x] fixed · structure-scatter-audit · `src/__tests__/helpers/reference-data.ts` → `src/__tests__/fixtures/reference-data.ts` · fixture data lived in `helpers/`; AGENTS.md puts fixtures in `fixtures/` — moved, 7 importers updated
- [x] dismissed · module-cohesion-audit · `src/hooks/use-reference-data.tsx` · provider + its two hooks are one concern
- [x] dismissed · module-cohesion-audit · `src/components/tables/investments.tsx` · flagged shape predates the slice
- [x] dropped · module-cohesion-audit · `src/hooks/use-reference-data.tsx` · `useOrderSettings` lives in a file named reference-data — a rename touches ~20 importers for a cosmetic gain
- [x] dismissed · tailwind-v4-audit · whole diff · 0 findings
- [x] fixed · reuse-scan · `src/components/investments/investment-overview.tsx:51` + `src/components/investments/investment-data-table.tsx:150` · the same investment → `OrderInvestmentT` literal written twice — extracted `toOrderInvestment()` beside `OrderInvestmentT` in `src/components/orders/order-dialog.tsx:20`
- [x] fixed · simplify · `src/components/telmak-check/telmak-check-dialog.tsx:29`, `src/components/transfers/transfer-data-table.tsx:67` · `?? undefined` shims around the hook's `null` — `ColumnOptionsT.referenceData` now takes `null`
- [x] dropped · reuse-scan · 8 dialogs/tables · `useReferenceData()?.workers ?? []` repeated — a selector helper would take the code as its parameter
- [x] dropped · simplify · `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:24` · two-line `workers` derivation — cosmetic
- [x] dismissed · reuse-scan · `src/components/investments/investment-overview.tsx:36` · Kosz banner resembles `KosztorysLockedBanner` but differs in copy and styling; moved unchanged from the page
- [x] dismissed · reuse-scan · `src/hooks/use-reference-data.tsx` · provider resembles `UnreadCountsProvider`; two instances with different outside-provider behaviour (null vs throw) — no factory
- [x] dismissed · simplify · `src/components/orders/order-button.tsx` · still takes `referenceData`/`orderSettings` as props — moving the read into the dialog is the dialog-level read dismissed above
- [x] dismissed · simplify · `src/components/kosztorys/summary/tabs/summary-investment-tab.tsx` · thin wrapper kept so every tab owns a file
- [x] dismissed · simplify · kosztorys „Inwestycja" tab · editor lock banner and overview banner both show for a trashed investment — plan intends both
- [x] dismissed · simplify · `src/app/(frontend)/layout.tsx:78` · `fetchReferenceData()` called in layout and pages — React `cache()` dedupes per request (`src/lib/queries/reference-data.ts:55`)
- [x] dismissed · simplify · `src/app/(frontend)/inwestycje/[id]/page.tsx:45` · assets awaited in the page's `Promise.all` instead of streaming — parallel with the other reads; the plan's contract takes `assets` as a prop

## Simplify pass

Ran simplify + primitive-reuse-scan in one pass — 2 applied, 0 proposed, 9 dismissed/dropped; each folded into ## Findings (tagged simplify / reuse-scan).

## Tests & suite
