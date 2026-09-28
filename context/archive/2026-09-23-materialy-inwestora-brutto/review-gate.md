# Review-gate ledger — materialy-inwestora-brutto · 2026-09-23

Gate run jointly over all unpushed commits on `zamrozone-brutto-wydatku-netto` (origin/staging..HEAD, 13 commits, 3 changes). Findings are filed in the ledger of the change that owns the file. Step 0.5 (browser pass) skipped — Playwright is not driven without an explicit go.

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review+code-review · `src/lib/kosztorys/breakdown-rows.ts:48` · investor categories sort by `localeCompare`, the manager's by SQL `ORDER BY name` — the plan's contract; insertion order is no better (a netto-only category would land after all brutto ones); identical for today's categories
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/breakdown-rows.ts:14` · with no stawka the per-category Razem (netto invoice at netto) differs from the list Razem (at brutto) on the same tab — the owner's recorded choice in `plan-brief.md` („gap in the investor's favour")
- [x] dropped · code-review+cohesion · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx` · `preview ?` branches → separate investor component — one component, two readings of the same data; revisit only if a third reading appears
- [x] dismissed · comment-noise · `src/lib/kosztorys/breakdown-rows.ts:36` · „Korekta goes last" — kept: it names the ordering decision the code alone doesn't justify
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
