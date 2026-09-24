# Review-gate ledger — materialy-inwestora-brutto · 2026-09-23

Gate run jointly over all unpushed commits on `zamrozone-brutto-wydatku-netto` (origin/staging..HEAD, 13 commits, 3 changes). Findings are filed in the ledger of the change that owns the file. Step 0.5 (browser pass) skipped — Playwright is not driven without an explicit go.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · no registry section for this change — added `## materialy-inwestora-brutto` with the plan's 6 manual bullets
      test: no automated test · — registry
- [x] 🔵 OBSERVATION · fixed · impl-review+code-review · `e2e/client-share.spec.ts:271` · the „no … netto row" check was a hard-coded regex that could pass vacuously — the seed now returns `categoryName` and the spec asserts the exact `${categoryName} netto` label is absent; the merge itself is pinned by the DOM spec
      test: TDD · e2e — assertion corrected; the spec was NOT run here (E2E runs only on your go), owed in the registry's Phase 3 check
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:238` · footer comment described only the manager's `billed` total — now names the investor's `amount` total too
- [x] 🔵 OBSERVATION · dismissed · impl-review+code-review · `src/lib/kosztorys/breakdown-rows.ts:48` · investor categories sort by `localeCompare`, the manager's by SQL `ORDER BY name` — the plan's contract; insertion order is no better (a netto-only category would land after all brutto ones); identical for today's categories
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:26` · unused `today` import (pre-existing) — deleted
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/breakdown-rows.ts:14` · with no stawka the per-category Razem (netto invoice at netto) differs from the list Razem (at brutto) on the same tab — the owner's recorded choice in `plan-brief.md` („gap in the investor's favour")
- [x] dropped · code-review+cohesion · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx` · `preview ?` branches → separate investor component — one component, two readings of the same data; revisit only if a third reading appears
- [x] fixed · comment-noise · `e2e/client-share.spec.ts:251,259` · deleted the „no dataset switch" comment (the loop says it; the rationale lives in the component) and trimmed „Both billed expenses in one list"
- [x] fixed · comment-noise · `src/__tests__/components/kosztorys/summary/tables/materials-breakdown-table.test.tsx:38` · comment restated `MIXED_ROWS` — deleted
- [x] dismissed · comment-noise · `src/lib/kosztorys/breakdown-rows.ts:36` · „Korekta goes last" — kept: it names the ordering decision the code alone doesn't justify
- [x] fixed · simplify (simplification+altitude) · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:178` · the investor/manager split was four separate `preview ?` ternaries (rows, label, key, footer sum) — one `listing` object built up front, rendered from
- [x] dismissed · simplify · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:179` · rows pass `clientVisibleExpenseRows` twice (tab + table) — pre-existing, deliberately fail-closed at the table so a future host can't leak settled rows
- [x] skipped · simplify (altitude) · `src/lib/kosztorys/breakdown-rows.ts:48` · move the netto-block layout out of `buildMaterialsBreakdown` into the manager's view so the investor merge needs no re-sort — changes the manager's row order and the builder's contract; behaviour-changing for a cosmetic gain, and the sort itself is the plan's ruling (dismissed above)
- [x] dropped · simplify (efficiency) · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:172` · the manager's partition/options are computed and discarded in preview — two O(n) passes over one investment's rows, compiler-memoized
- [x] dropped · simplify (reuse) · `src/lib/kosztorys/breakdown-rows.ts:26,45` · key template and `localeCompare(…, 'pl')` written inline — no shared comparator exists; trivial

## Simplify pass

Ran /simplify (joint run, see zamrozone-brutto-wydatku-netto) — 1 applied, 0 proposed; findings folded into ## Findings (tagged simplify). Report: `/private/tmp/claude-501/-Users-konradantonik-workspace-yolo-wykonczymy/8e2c7b28-971a-4b42-affb-7c9fe83aaf28/scratchpad/simplify-2026-09-23.md`

## Tests & suite

- typecheck — clean
- lint — 0 errors, 83 warnings (pre-existing, none in touched files)
- test (unit + DOM) — 349 files / 4059 passed, 73 skipped
- test:integration (5435 db-test) — 71 files / 332 passed
- test:e2e — not run (never unprompted); `e2e/client-share.spec.ts` edit owes an owner run, tracked as a manual check
- build — not run
- **Archive blocked:** every box in `## Findings` is checked, but the change's manual checks in `context/foundation/manual-checks.md` are unticked → slice stays **in review**
