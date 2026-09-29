# Review-gate ledger — investments-list-payout-remaining · 2026-09-29

Base: `e6748079` (branch point) · commits `0ff18315`, `57e97c77`, `2334a3b7`.
Step 0.5 (verify-manual-checks) skipped — it drives the browser and the user said "no tests";
the manual checks stay pending in `context/foundation/manual-checks.md`.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.

## Findings

- [x] 🟡 WARNING · skipped · impl-review · `plan.md` Whole-tree Gate · `pnpm test` not run — typecheck + lint clean; the unit leg is deferred by the user ("no tests"); the new/changed specs were green at `0ff18315`/`57e97c77`
      test: no automated test — the finding IS the test run; owed at the next suite run (pre-push runs it anyway)
- [x] 🔵 OBSERVATION · fixed · impl-review · `research.md:142`, `plan-brief.md:33` · claimed the investment page does not role-gate the Podwykonawcy figure; it does (`investment-summary-panel.tsx:61-69`, `canSeeMargin`) — docs corrected; the ungated column stays, it is the owner's call
      test: no automated test — docs only
- [x] 🔵 OBSERVATION · dismissed · impl-review · `investments.tsx` `UnsettledStages` · extracted beyond plan scope — a benign dedup, shared by both withheld cells
- [x] 🔵 OBSERVATION · dismissed · code-review · `shape-investments.ts:103-106` · grosz rounding of `due − payouts` could differ from the panel on half-grosz inputs — both sides call `roundToCents` on the same operands; the parity spec compares to the grosz across the whole dump
      test: no automated test — parity spec already pins it
- [x] 🔵 OBSERVATION · dismissed · code-review · `shape-investments.ts:103-106` · `-0` vs `0` after rounding — renders identically in `BalanceCell`, `toBe(0)` spec pins the residue case
      test: no automated test — covered by the float-residue unit spec
- [x] 🔵 OBSERVATION · dismissed · code-review · `investments.tsx` column `sortUndefined: 'last'` · „brak danych" and „ustaw etapy" rows interleave at the bottom — same as Marża v2, the precedent the plan copies
- [x] 🔵 OBSERVATION · skipped · code-review · `investment-render-parity-db.test.ts:244` · coverage counter only counts non-zero printed kwoty; could also assert a floor — strengthening needs a parity run to validate the instrument, and the user said no tests
      test: no automated test — spec change deferred with the parity run
- [x] 🔵 OBSERVATION · skipped · code-review · `investment-render-parity-db.test.ts` · detail side reuses the listing's `subcontractorDue` map implicitly through `byPlane` — należne is pinned SQL↔tree by `kosztorys-subcontractor-due.test.ts`; nothing to add here
      test: no automated test — pinned elsewhere
- [x] 🔵 OBSERVATION · dropped · code-review · `investments.tsx` `V2_COLUMN_IDS` · a saved column-visibility state predating the column shows it once regardless of the „Kolumny v2" switch — one-time per browser, no data impact
- [x] fixed · simplify · `investments.tsx` · the Marża v2 and Pozostało cells duplicated the withheld-figure body → one module-level `withheldFigureCell`
- [x] fixed · comment-noise-audit · `investments.tsx`, `shape-investments.test.ts`, `investment-render-parity-db.test.ts` · 4 trims + 2 deletions of restating comments; `UnsettledStages` comment reworded to cover both figures
- [x] fixed · simplify · `shape-investments.test.ts` · `kosztorysTotals` duplicated verbatim in three describes → one module-level fixture
- [x] fixed · simplify · `shape-investments.test.ts` · pozostało financials carried operands it never reads → `{ ...ZERO_FINANCIALS, totalPayouts: 1000 }`
- [x] fixed · simplify · `shape-investments.test.ts` · `remainingFor` positional booleans (`remainingFor(x, false, kosztorysTotals, paid030)`) → options object
- [x] fixed · simplify · `shape-investments.test.ts` presence test · `-1000` / `undefined` asserted twice (explicit expects + `toEqual` override) → dropped the explicit pair; the −wypłaty case has its own spec
- [x] fixed · simplify · `investment-render-parity-db.test.ts` · `kosztorysTotals[String(inv.id)]` looked up three times → `invTotals`
- [x] dropped · simplify · `investment-render-parity-db.test.ts:224-249` · unify marża v2 / pozostało comparison behind one `agrees()` — the two compare different absence types (`null` vs `undefined`) and one is pre-rounded; a helper for two call sites buys nothing
- [x] dropped · simplify · `investment-render-parity-db.test.ts:241` · payout fetch runs sequentially per investment — ~0.2 s over the dump, and parallelizing would fetch for withheld investments too
- [x] dismissed · module-cohesion-audit · `investments.tsx` exports `V2_COLUMN_IDS` + `getInvestmentColumns` · predates the branch; a column-defs file owning its id list is cohesive
- [x] dismissed · tailwind-v4-audit · — · clean
- [x] dismissed · feature-first-structure / structure-scatter-audit · — · no new files; every edit landed in the figure's existing home

## Simplify pass

Ran /simplify — 5 applied, 0 proposed, 2 dropped (reuse: none; altitude: none — leaving the figure inline in `shapeInvestments`); each finding folded into ## Findings (tagged simplify).

## Tests & suite

- `pnpm typecheck` — clean (after the review-gate edits)
- `pnpm exec eslint` on the touched files — clean
- `pnpm test`, `test:integration`, `test:e2e`, `build` — deferred by the user ("no tests")
- Parity (`investment-render-parity-db.test.ts`) — green at `57e97c77`, run against the dev DB on 5433, not `db-test` (5435 carries foreign migrations `20260929_1/_2` from another checkout); instrument validated with a +0.01 mutation. Not re-run after the test-only refactor above.
- E2E — not owed: a read-only column over a figure pinned by unit specs + the listing↔panel parity spec; nothing crosses action → DB → revalidation.
