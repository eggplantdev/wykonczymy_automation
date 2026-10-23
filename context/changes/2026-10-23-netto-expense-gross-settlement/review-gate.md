# Review-gate ledger — netto-expense-gross-settlement · 2026-10-23

Scope: `05bf89af6...HEAD` (1d6346b80, 1c6da8b1a, dca024c0b). Checks: impl-review, code-review,
comment-noise + tailwind (flag-only). No browser verification pass.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/components/tables/investments-header-tips.ts:18` · „Wydatki inwestycyjne” tooltip said „bez zapisanej stawki — sam paragon”, silent on the grossed netto expense — copy extended
      test: no automated test — static tooltip copy; covered by a manual check
- [x] 🟡 WARNING · skipped · impl-review + code-review · `src/lib/db/calculate-balance.ts:5` · `balanceFromTransactions` (v1) and the category cost fields still read netto expenses at raw netto — v1 and „Lista wydatków” figures are out of scope by plan (`plan.md:42`); category costs are invoice figures by owner ruling
      test: no automated test — intended behaviour, nothing changed
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/lib/kosztorys/breakdown-rows.test.ts` · nothing asserted the breakdown Σ equals `billedMaterials` — added a per-rate parity spec
      test: TDD · unit — Σ of the priced rows vs `billedMaterials` at 0.12 / 0.23 / null
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:41` · the „*” was applied by index after pricing — now derived inside `pricedBreakdownRows` from `rate == null`
      test: TDD · unit — „without a rate stars only the netto rows”
- [x] 🔵 OBSERVATION · dropped · impl-review · `materials-breakdown-table.tsx:38` · VAT 0% still shows the footnote „0%” — harmless, no such investment
      test: no automated test — unreachable in practice
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/queries/whole-investment-financials.ts:38` · `Σ rows === totalMaterialCosts` — still true of the raw rows it documents
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/summary-economics.ts:20` · `materialsNetDiscount` comment claimed the netto bucket „carries no VAT toward the investor” — rewritten
- [x] dismissed · code-review · `src/lib/db/investment-financials.ts:77` · comment „already netto” — still true
- [x] fixed · comment-noise · `src/types/investment-financials.ts:12` · „frozen against the toggle” → „which the toggle never reduces”
- [x] fixed · comment-noise · `src/lib/kosztorys/breakdown-rows.ts:8` · two-sentence comment restating the branch — removed with the rule moved to `billedNetExpense`
- [x] fixed · comment-noise · `src/lib/kosztorys/breakdown-rows.ts:34` · „netto invoice is frozen” → „priced differently”
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/breakdown-rows.test.ts:111` · test title „plus the frozen invoice” → „plus the invoice”
- [x] dismissed · tailwind · `materials-breakdown-table.tsx` · footnote markup — utilities only, `Description` primitive
- [x] fixed · simplify · `src/lib/kosztorys/summary-economics.ts:29` · netto-grossing rule written twice (`billedMaterials`, `breakdownRowPair`) — extracted `billedNetExpense`
- [x] fixed · simplify · `materials-breakdown-table.tsx:76` · footnote at default size vs `size="xs"` in `settlement-summary.tsx`; „* Wydatki” vs repo's „*Minusowa” — aligned both
- [x] skipped · simplify · `vatRate` threaded beside `netRate` through ~8 call sites — a single pricing object is a medium signature refactor for no behaviour gain
- [x] dropped · simplify · `materials-breakdown-table.tsx:45` · fold `const table` + early return into one return — adds a wrapper div, churn
- [x] dismissed · simplify · `src/__tests__/lib/kosztorys/summary-economics.test.ts:297` · `computeAmountDue` no-rate test duplicates `billedMaterials` — it guards the public figure the panel shows
- [x] dropped · simplify · `materials-breakdown-table.test.tsx` · two „no asterisk” tests could be `it.each` — cosmetic
- [x] dismissed · simplify (efficiency) · no wasted work found

## Simplify pass

Ran /simplify (4 agents) — 2 applied, 2 skipped/dropped, 2 dismissed; findings folded above.

## Tests & suite

- Affected specs (`lib/kosztorys/`, `components/kosztorys/summary/`, `shape-investments`, `tables/investments`): 161 files, 1887 passed.
- ESLint on touched files: clean.
- Typecheck: only the 3 worktree-only baseline errors (missing generated `importMap.js`).
- Full suite, e2e, render-parity db spec: not run (need explicit ask).
