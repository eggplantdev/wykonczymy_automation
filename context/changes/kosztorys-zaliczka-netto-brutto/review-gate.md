# Review-gate ledger — kosztorys-zaliczka-netto-brutto (EX-536) · 2026-07-21

Slice range: `ae3125b3..1cbec1fe` (base `ae51384b`). 39 files, +594/−664.
Step 0.5 (verify-manual-checks) already ran this session: 8/8 boxes ticked, no open findings.

## Findings

<!-- ONE checkbox per finding — every source folds here. Most-severe first. -->

Fan-out result: **0 CRITICAL, 0 WARNING**. impl-review + code-review both PASS (code matches plan, diff safe); file-organization audit clean; Tailwind clean; comment-noise no deletes. All findings below are 🔵 OBSERVATION or structural.

- [x] 🔵 OBSERVATION · fixed in-slice · `impl-review` · `src/components/forms/expense-form/expense-form.tsx`, `internal-transfer-form.tsx` · The `paymentMethod` companion picker was wired into the deposit form only; expense + internal-transfer forms still hardcoded `paymentMethod: 'CASH'`. — User directed: finish the companion. Rendered `<PaymentMethodField>` in both forms (both already defaulted + submitted `paymentMethod`, only the picker was missing). Typecheck + lint clean.
      test: test-driven-debugging · e2e — browser-level binding; E2E regression coverage owed → filed **EX-563** (e2e-backlog).
- [x] 🔵 OBSERVATION · fixed · `code-review`+`impl-review` · `kosztorys-wplaty-list.tsx:26` · Header comment said "every INVESTOR_DEPOSIT" but the read returns all three deposit types (legacy `OTHER_DEPOSIT` rows appear). — Corrected comment to "every wpłata (deposit)". Aggregate itself is correct (equals old `totalIncome`, which summed all deposit types).
      test: no automated test — comment-only fidelity fix, no behavior change.
- [x] 🔵 OBSERVATION · dropped · `code-review`+`impl-review` · `kosztorys-wplaty-list.tsx:52` · Each row links to `?type=INVESTOR_DEPOSIT`; a legacy non-investor row mis-navigates (filtered out at destination). — Too minor to fix: 4 dying legacy rows repo-wide, no new ones can be created (picker trimmed), and a correct link would need `type` threaded through the query + `DepositRowT` — churn with no real payoff.
- [x] 🔵 OBSERVATION · dismissed · `code-review`+`impl-review` · `summary-economics.ts:computeDoZaplatyRM` · A GROSS deposit reduces only the gross axis (net can exceed gross). — Owner-confirmed sequential model ("dokładnie"), test-locked (`brutto bucket subtracts from the gross axis, leaves netto untouched`). Intended.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/hooks/transfers/validate.ts` · No hook clears a stray `vat_plane` on a non-deposit row. — Benign: read filters by `type IN depositTypesInList` and `reduceDepositBuckets` only classifies rows that reach it, so a stray flag is never read.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `kosztorys-do-zaplaty-block.tsx:135` · The four hide-exempt figures render as an inline `text-sm` row — meets "always-visible, one source" but only weakly the owner's "niech to będzie jasne" prominence ask. — Subjective design fidelity; the manual-verification pass already accepted this rendering (box ticked), owner sees it in dogfooding.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `20260721_1_add_vat_plane_to_transactions.ts:8` · Plan said `varchar` + CHECK; impl created a pg enum. — Justified correct deviation: the collection field is `type: 'select'`, which Payload maps to a pg enum (`enum_<table>_<field>`); a varchar would drift under `generate:types`.
- [x] dropped · `comment-noise` · `kosztorys-do-zaplaty-block.tsx:12`, `kosztorys-etap-totals.tsx:48` · Two mild comment-restatement trim candidates. — Auditor marked "trim only if churning the file anyway"; not touching those files, not worth standalone churn.
- [x] dismissed · `file-organization`+`tailwind` · (whole slice) · Placement/cohesion/scatter clean; `chart-green`/`chart-orange` confirmed real `@theme` tokens; no pre-v4 patterns. — Nothing to act on.
- [x] fixed · `simplify`(altitude) · `vat-plane-field.tsx:13`, `payment-method-field.tsx:13` · Render-prop param typed `field: any` (+eslint-disable) while all 7 sibling wrappers use `AppFieldComponentsT`, dropping the `field.Select` type-check. — Typed both to `AppFieldComponentsT`, removed the disables.
- [x] fixed · `simplify`(simplification) · `kosztorys-summary.tsx:122` · `sumaPrac` recomputed `summaryLine(...)` identical to what `computeSummarySplit` already builds internally as `laborCosts`. — Now destructures `laborCosts: sumaPrac`; removed the recompute + the now-unused `summaryLine` import.
- [x] fixed · `simplify`(simplification) · `src/lib/actions/transfers.ts:244` · Comment narrated the `beforeValidate` etap-tag hook that this slice's teardown deleted. — Removed (STRIP TEST fail).
- [x] dismissed · `simplify`(simplification) · `summary-economics.ts:31` · `faceValue` `export` flagged as over-exported. — Kept: the test imports it directly (`summary-economics.test.ts:5`).
- [x] skipped · `simplify`(reuse) · `vat-plane-field.tsx` + `payment-method-field.tsx` · ~15 shared lines; no existing abstraction to reuse. — A generic `EnumSelectField` would be a net-new refactor across 5 other inline `field.Select` call sites — review-worthy on its own, out of this slice.

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude) — **4 applied, 0 proposed, 2 dismissed/skipped**; each folded into `## Findings` (tagged `simplify`). Efficiency + reuse came back clean (deposit read fetched once & shared, buckets reduced once; no re-implementation of existing helpers).

## Tests & suite

- **Unit** `summary-economics.test.ts` (14 tests) — ✅ green after the `/simplify` edits (owner example 2000/1000→1000/1080, legacy-at-face both axes, brutto bucket, reducer).
- **No new regression tests owed** — review found 0 correctness bugs; all findings were observations (dismissed/dropped) or the one open scope decision. Behavior tests were already authored in the Step 0.5 verification pass.
- **Lint** (touched files) — 0 errors; 8 pre-existing warnings in `kosztorys-summary.tsx` (disabled pie-chart imports), none from this slice.
- **Typecheck** — 1 error, **pre-existing & out of scope**: `src/scripts/seed-investment-from-sheet.ts:244` wants `draft: true` on a `kosztorys-items` create (Payload generated-types drift). File is byte-identical to base `ae51384b`, not in the slice diff, not touched by any EX-536 or `/simplify` edit. Not a regression. Full `pnpm typecheck`/`build` leg is red only because of it.
- Full suite (`typecheck && lint && test && test:e2e && build`) **not run to completion** — blocked by the pre-existing seed-script typecheck error above, unrelated to this slice.
