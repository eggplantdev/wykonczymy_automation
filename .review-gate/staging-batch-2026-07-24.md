# Review-gate ledger — branch `konradantonik/ex-536-zaliczka-v2` → origin/staging · 2026-07-24

Unit of work: the **63 commits** `origin/staging (87dc511c) .. HEAD (25583ff6)` — the whole
zaliczka / tryb-mieszany / netto-brutto arc. **107 files, +5187 / −1488** (72 non-test code files,
11 test files, 24 doc files). Clean superset of staging (63 ahead, 0 behind → clean merge). No single
10x change folder anchors it → fallback branch-diff scope; ledger lives in `.review-gate/`.

Change folders in scope (in-flight, touched vs staging): `netto-expense-type` (EX-536),
`kosztorys-tryb-mieszany`, `kosztorys-zaliczka-v2`, `etap-tool-plane` (EX-565),
`kosztorys-percent-rabat-bulk-apply` (EX-564).

New migrations (both `transactions` schema): `20260721_0_drop_kosztorys_stage_from_transactions`,
`20260721_1_add_vat_plane_to_transactions`. Prod migration is a deploy-time gate, not a slice blocker.

Surviving checks (fan-out): `/code-review` (diff-scoped), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `tailwind-v4-audit`,
`comment-noise-audit` (flag-only, diff-scoped). `/10x-impl-review` **subsumed into doc
reconciliation** — 5 change folders, no single anchoring `plan.md`, and initial decisions were
overturned, so "does code match plan" is the reconciliation job (Phase D), not a mechanical run.

Step 0.5 (browser/manual verification): **skipped by user directive** (2026-07-24) — "do not do any
manual checks; add any found to `context/foundation/manual-checks.md`". Fan-out only; manual checks
are collected into the registry, not executed.

## Findings

<!-- ONE checkbox per finding. [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry: test: <test-driven-debugging | TDD | no automated test> · <unit|integration|e2e> — why -->

<!-- tailwind-v4-audit: CLEAN — 42 files inspected, zero anti-patterns introduced. No `var(--x)` in
     `[...]`, no dynamic-string classnames, no illegitimate arbitrary values (the `transition-[height]`
     / `data-[state=…]` / `gridTemplateColumns` cases are all correct v4 usage). New `--shadow-panel`
     @theme token consumed via generated `shadow-panel` utility — correct pattern. Nothing to fix. -->

<!-- code-review: 1 WARNING (act on), 3 OBSERVATIONS. Verified correct: summary-economics money math
     (grossPair inverse, materiały planes combined without inventing VAT, mixed settlement no double-deduct),
     bucketDepositsByPlane null=netto, chart-slices, full vatPlane plumbing end-to-end, and the clean
     removal of the zaliczka-by-stage plane (zero dangling readers of kosztorys_stage_id). -->

- [x] 🟡 WARNING · fixed · code-review · `page.tsx:90` · non-mixed „Wpłaty"/„Do zapłaty" drew `wplatyNet = financials.totalIncome` (ALL DEPOSIT_TYPES incl COMPANY_FUNDING + OTHER_DEPOSIT) while the deposit list / Wpłaty tab / plane pie / Mieszane use `getDepositTransactionsForInvestment` (INVESTOR_DEPOSIT-only) → same panel showed 3 deposit totals per toggle. **Fixed:** `wplatyNet = depositTransactions.reduce(…amount)` — the same INVESTOR_DEPOSIT-only base, no `financials.ts` touch. Self-consistency-restoring, not a new domain ruling: the query's own docblock + 3/4 panel surfaces already exclude legacy planes (EX-557: form hides investment on COMPANY_FUNDING, so fresh rows can't attach → blast radius = legacy/admin only). **⚠ CLIENT-FACING money change on legacy data — flagged in close-out for owner visibility.**
      test: TDD · integration — **authored** `src/__tests__/lib/db/get-deposit-transactions.test.ts`: asserts the query returns only non-cancelled INVESTOR_DEPOSIT rows (Σ excludes COMPANY_FUNDING + OTHER_DEPOSIT), guarding the exact base `wplatyNet` now sums. DB-integration (5435) — runs in the suite gate.
- [x] fix-now · fixed · code-review · `reference-data.ts:61` · DepositTransactionRowT docstring said "INVESTOR_DEPOSIT / COMPANY_FUNDING" — trimmed to INVESTOR_DEPOSIT-only to match the query.
- [x] skipped · 🔵 OBSERVATION · code-review · `kosztorys-totals-panel.tsx:127` · `useState(vatPercent)` seeds `materialsReductionPercent` once; won't track a `vatRate` change. Latent only — `vatRate` is a server-sourced constant prop today, no live failure. Not worth a behavior change now.
      test: no automated test — latent, no observable failure with current constant prop.
- [x] dismissed · 🔵 OBSERVATION · code-review · migration `20260721_1` deploy-ordering · `vat_plane` SELECT 500s if code ships before the migration runs. NOT a code bug — deploy-time gate. → recorded as a deploy/manual note (migrations owed to preview+prod before/with this merge), not a code finding.

<!-- file-organization (feature-first + module-cohesion + structure-scatter): CLEAN. Contract types in
     the right tier (cross-cutting row shapes in types/, form fields colocated). Every component/hook
     single-concern. No new competing homes — summary tables funnel through one SummaryTable primitive,
     chart-slice logic all in chart-slices.ts. -->

- [x] dropped · structure-scatter · `summary-axis.ts:1` · `summaryMoneyCols` (col-string builder) sits in kosztorys/ while the `SUMMARY_LABEL_COL`/`SUMMARY_VALUE_COL` + `SummaryTable` it feeds live in `ui/summary-grid.tsx` — but it also depends on `MoneyAxisT`/`axisShows` from `lib/kosztorys/money-axis.ts`, so kosztorys placement is defensible (a wash). Too marginal to churn. Dropped.

<!-- comment-noise-audit: 0 pure-noise deletions. 3 vanished-state clauses to trim (comments otherwise
     load-bearing — keep the invariant, cut the code-history framing). Applied in the fix pass. -->

- [x] fix-now · fixed · comment-noise · `use-summary-axis.ts:15` · trimmed "was removed / no longer valid" → present tense; kept the persisted-`'both'`→default fallback invariant.
- [x] fix-now · fixed · comment-noise · `brutto-netto-summary.tsx:88` · trimmed "no longer a waterfall deduction" clause; kept the `Łącznie − Wpłaty = Do zapłaty` accounting invariant.
- [x] fix-now · fixed · comment-noise · `brutto-netto-summary.tsx:109` · trimmed "now … not a deduction" opener (dup); kept the prace-plane/gross rationale.
- [x] dismissed · comment-noise · `money-axis.ts:299`, `summary-grid.tsx:257` · borderline "now"/mild-restatement — survive STRIP TEST (justify a concrete constraint / part of a doc-symmetry set). Keep.

## Simplify pass

Ran a read-only simplification analysis over the summary/kosztorys cluster (22 files); 6 findings, applied in the main thread — 5 fixed, 1 dropped. Each folded into `## Findings` below (tagged `simplify`). Typecheck green after the multi-file prop-prune.

- [x] fixed · simplify · `chart-slices.ts:22` · extracted `paintSlices()` — all 4 pie builders shared the identical filter-zero + color-by-index tail; now build raw `{id,name,value}[]` and funnel through one helper.
- [x] fixed · simplify · `summary-economics.ts:70` · `summaryLineGross` re-implemented the `deriveNet=true` branch of `materialyPair` 30 lines above → now delegates to `materialyPair(gross, vatRate, true, reduction)`, keeping the reduction-vs-VAT-strip rule in one place.
- [x] fixed · simplify · `summary-stages-tab.tsx:41` · local `pair(net)` reinvented `moneyPair` → import + use `moneyPair`; dropped the `toGross` import.
- [x] fixed · simplify · `mixed-summary.tsx:46` · local `money(amount)` reinvented `faceValue` → import + use `faceValue` at all 9 sites.
- [x] fixed · simplify · `summary-breakdown-table.tsx:47` · table re-derived `materialsGross` by re-summing `materialyBreakdown` the parent already holds as a scalar → take `materialsGross: number`; pruned the now-dead `materialyBreakdown` prop up its chain (BruttoNettoSummary → SummaryOverviewTab → panel keeps it only for the Wydatki tab).
- [x] dropped · simplify · `summary-expenses-tab.tsx:47` · `materialsReductionPercent / 100` duplicates the panel's `/100` — but the tab needs the raw percent for its CoeffField, so only a second `/100` would move; too minor to churn.
- [x] fixed · simplify(followup) · `summary-economics.ts:105`, `brutto-netto-summary.tsx:40` · WARNING fix left "(totalIncome)" / "= −Bilans" comments describing `wplatyNet` — retuned to "Σ INVESTOR_DEPOSIT" so the prose matches the narrowed base.

## Tests & suite

- **Manual checks: registered, not executed** (user directive 2026-07-24). `context/foundation/manual-checks.md` — retired the stale typed-`C` slice-B checks (removed 2026-07-23) and added a consolidated `kosztorys-podsumowanie-tabs` section: money-axis (Netto/Brutto/Mieszane), materiały brutto→netto reduction, deposit vatPlane split, the ⚠ `wplatyNet` INVESTOR_DEPOSIT-only base (owner sign-off flagged), Wydatki/Robocizna tabs + „Postęp prac" bar, and the two-migration deploy-ordering note.
- **`pnpm typecheck`: green** (run after the multi-file prop-prune).
- **Full suite (lint / test / test:e2e / build): NOT run — awaiting user go.** The DB-integration leg (`get-deposit-transactions.test.ts`) needs the 5435 `db-test` container up.

## Doc reconciliation (Phase D)

Discovery map compiled (agent) + code-verified. **What shipped vs what the docs say:**

**Change folders (5):**

- `netto-expense-type` (EX-536) · `planned` — **VERIFIED not shipped** (no `INVESTMENT_EXPENSE_NET`/`netAmount`/`netRate` in code; only a design/plan doc rides this branch). Status correct. ⚠️ internal design wrinkle: commit `9e52b393` "netRate editable per expense" vs `design.md` "netAmount immutable after create" — reconcile intent (future work, low priority).
- `kosztorys-tryb-mieszany` (EX-536) · `implemented` — shipped, and plan.md already carries a "Reconciled 2026-07-22 — shipped differently in 3 ways" banner + the 2026-07-23 flip (manual cash `C` removed → derived from Σ netto wpłaty; deposit `vatPlane` default brutto→netto). Docs already reconciled to reality. ✔
- `kosztorys-zaliczka-v2` (EX-536) · `implemented` — shipped (materiały brutto→netto waterfall). plan.md flags a **half-translated identifier `materialyNet`/`materialsNet`** to fix (AGENTS.md rule 3 violation) — verify in code.
- `etap-tool-plane` (EX-565) · `planned` — **docs-only on this branch** (no impl commits). Correct.
- `kosztorys-percent-rabat-bulk-apply` (EX-564) · `planned` — **docs-only** (no impl commits). Correct.

**Roadmap gaps (`context/foundation/roadmap.md`):**

- No slice row for zaliczka-v2 / tryb-mieszany / netto-expense-type / etap-tool-plane / percent-rabat. The whole arc lives ONLY as blocker prose under **S-12** (EX-536, roadmap.md:464) — "vatPlane shipped, presentation-only, does not feed bilans/marża."
- Two `implemented` change folders (zaliczka-v2, tryb-mieszany) have **no roadmap representation**.
- EX-564 / EX-565 absent from roadmap entirely.

**Reconciliation actions (Phase D — all resolved 2026-07-24):**

- [x] roadmap · added a "Shipped beyond the entry-axis (zaliczka-v2 batch)" bullet under S-12: the EX-536 presentation layer grew into the full tabbed Podsumowanie (netto/brutto/mieszane axis, materiały brutto→netto, breakdown tables, postęp-prac move), still presentation-only, does not unblock S-12 archive.
- [x] roadmap · registered EX-564 (percent-rabat, Backlog) + EX-565 (etap-tool-plane, Todo) as planned follow-ons under S-12; both docs-only, tracked in Linear.
- [x] linear · verified — all three states already correct: EX-536 **Done** (decision made, entry-axis shipped — the branch is its impl, not a reopened question), EX-564 **Backlog**, EX-565 **Todo**. No changes.
- [x] identifier · verified — the plan-flagged `materialyNet`/`materialsNet` is **not in shipped code**. The real half-translations (`wplatyNet`, `materialyPair`, `materialyBreakdown`) are AGENTS.md rule-3 violations but **pervasive and parked under EX-548** ("the rest of the codebase is undecided; do not fix beyond EX-532", owner ruling) → not renamed now, by mandate.
- [x] traceability · added `linear: EX-536` to `kosztorys-zaliczka-v2/change.md` frontmatter.
