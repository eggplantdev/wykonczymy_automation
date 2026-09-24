# Review-gate ledger — zamrozone-brutto-wydatku-netto · 2026-09-23

Gate run jointly over all unpushed commits on `zamrozone-brutto-wydatku-netto` (origin/staging..HEAD, 13 commits, 3 changes). Findings are filed in the ledger of the change that owns the file. Step 0.5 (browser pass) skipped — Playwright is not driven without an explicit go.

## Findings

- [x] 🟡 WARNING · fixed · impl-review+code-review · `src/lib/queries/investment-financial-fields.ts:35` · `netCategoryGrossCosts` defaulted to `[]`, so a caller passing only the netto sums type-checked and priced every „… netto" row at brutto 0 — now one `Pick<CategoryBreakdownsT, …>` object with a both-empty default; caller passes `breakdowns`, specs updated
      test: no automated test · unit — the guard is the type: the split call no longer compiles; typecheck enforces it
- [x] 🔵 OBSERVATION · fixed · impl-review+cohesion · `src/lib/kosztorys/breakdown-rows.ts:14` · `breakdownRowPair` redefined the row union inline and lived in `summary-economics` after its other callers were deleted — moved beside its only callers, typed as `MaterialsBreakdownRowT`; its spec block moved to `breakdown-rows.test.ts`
- [x] 🔵 OBSERVATION · skipped · code-review · `src/scripts/seed-materials-net.ts:52` · netto fixture pairs are exactly 23% apart, so the DB parity spec can't tell invoice brutto from rate-derived brutto — changing the amounts forces a golden-master regen (`financial-golden-master-db`) for a rule the unit + DOM specs already pin with 8%-apart pairs; the seed comment states the limit
      test: no automated test · integration — unit (`breakdown-rows.test.ts`) and DOM (`materials-breakdown-table.test.tsx`) already assert the invoice brutto at 12%/23%
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/__tests__/derive-financials-bucketing.test.ts:234` · spec not at the mirrored path — it extends the existing `deriveCategoryBreakdowns` suite where every sibling case lives; the mirror file has never tested that function
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/queries/investment-financial-fields.ts:53` · a netto wydatek with no category would fall into „Korekta" as a brutto row — pre-existing, not in this diff, reachability unverified (the collection doesn't enforce a category but the form path is unchecked); not filed per reachability-first
      test: no automated test · — not a finding of this diff
- [x] fixed · simplify · `src/lib/queries/investment-financial-fields.ts:40` · the `NOTHING_BILLED_NET` default let a caller omit the netto data entirely, which the one-object guard exists to prevent — parameter now required, constant moved into the spec
- [x] skipped · simplify (altitude) · `src/types/investment-financials.ts:81` · carry the invoice brutto ON each `netCategoryCosts` entry instead of a parallel `netCategoryGrossCosts` list — the cleaner shape, but it rewrites a type shared with the listing cache, `sum-transfers` and the golden-master fixture; a review-worthy refactor, and the pair can no longer drift apart now that it is one required object
- [x] dropped · simplify (reuse) · `src/lib/kosztorys/breakdown-rows.ts:44` · inline pair sum twins `combinedPair`'s — a one-line `addPairs` helper is no simpler than the expression

## Simplify pass

Ran /simplify (4 agents: reuse + primitive-reuse-scan, simplification, efficiency, altitude) — 1 applied, 0 proposed, 2 skipped/dropped here; findings folded into ## Findings (tagged simplify). Report: `/private/tmp/claude-501/-Users-konradantonik-workspace-yolo-wykonczymy/8e2c7b28-971a-4b42-affb-7c9fe83aaf28/scratchpad/simplify-2026-09-23.md`

## Tests & suite

- typecheck — clean
- lint — 0 errors, 83 warnings (pre-existing, none in touched files)
- test (unit + DOM) — 349 files / 4059 passed, 73 skipped
- test:integration (5435 db-test) — 71 files / 332 passed
- test:e2e — not run (never unprompted); `e2e/client-share.spec.ts` edit owes an owner run, tracked as a manual check
- build — not run
- **Archive blocked:** every box in `## Findings` is checked, but the change's manual checks in `context/foundation/manual-checks.md` are unticked → slice stays **in review**
