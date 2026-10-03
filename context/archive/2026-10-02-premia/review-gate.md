# Review-gate ledger — premia (EX-979) · 2026-10-02

Scope: `9a743246` (merge-base with `staging`) → working tree on `premia` — p1–p5 + the OWNER/ADMIN-only gate.
Step 0.5 (browser verification) skipped: the Playwright pass is driven only on request; manual checks stay in
`context/foundation/manual-checks.md` § EX-979.

## Findings

- [x] ⚠️ WARNING · dismissed · impl-review F3 · `subcontractor-worker-totals.tsx:76` · „Rozlicz wypłaty" shows on a locked/withheld investment, unlike plan 4.3 — the listing's existing button (`tables/investments.tsx`) uses the same ungated rule and the dialog greys blocked rows; consistent, accepted deviation
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dropped · code-review + impl-review · `src/components/forms/expense-form/draft-type.ts:14` · a restored BONUS draft ignores the role — needs an OWNER and a MANAGER in one browser tab; unreachable in practice and the server refuses it anyway
      test: no automated test — unreachable
- [x] 🔵 OBSERVATION · dismissed · impl-review F4 · `subcontractor-payouts-table.tsx:93` · „Lista wpłat" drill-down links PAYOUT only — the table lists cash wypłaty only (`cashPayouts`), so its drill-down matches what it shows; the totals link carries BONUS
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 · `context/foundation/test-plan.md` risk #1 · premia term not added as plan phase 5 said — the plan said „#1/#16"; the #16 row already names the premia as the third term of every „Pozostało" and its guards, and #1 is the generic cross-surface risk with no figure-level terms
      test: no automated test — doc
- [x] 🔵 OBSERVATION · dismissed · impl-review F6 · `src/__tests__/sum-transfers.test.ts` · no register-balance BONUS case — covered: validate-hook nulls the register, the DB spec asserts `source_register_id: null`, register sums count only rows with a register; `computeAmountDue` takes no financials object
      test: no automated test — already guarded at the integration layer
- [x] 🔵 OBSERVATION · dismissed · impl-review F7 · `src/lib/actions/transfers.ts:250` · OWNER/ADMIN can move a premia to another investment — same as a PAYOUT, both pairs show the effect at once; pinning it would be a new owner rule
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · impl-review F8 · `book-overpayment-bonus.ts:42` · investment lock covers only the dialog paths — predates the slice (`settlePayoutsAction` has the same), worst case is a visible, cancellable premia
      test: no automated test — no defect in this slice
- [x] fixed · code-review · `src/types/transfers.ts:65`, `src/lib/kosztorys/types.ts:189` · doc comments still say „PAYOUT rows" though the rows carry BONUS too — both now say PAYOUT and BONUS
- [x] fixed · code-review · `subcontractor-worker-totals.tsx:77` · `totals.bonus !== 0 ||` redundant — the total is the sum of the row premie — operand and its comment removed
- [x] dropped · code-review · `getPayoutTransactionsForInvestment` name drift — rename churn across callers for a name the `type` column already disambiguates
- [x] fixed · structure-scatter · `settle-payouts-schema.ts:39-46` · `bookOverpaymentBonusSchema` sits in the form's schema file but only the action uses it — moved inline into `book-overpayment-bonus.ts`, `BookOverpaymentBonusT` with it
- [x] dismissed · reuse (structure agent) · `book-overpayment-bonus.ts:28` · use `ownerOnlyAction` — it hard-codes `isAdminOrOwnerRole`, which would re-split the premia rule F2 unifies on `canBookTransferType`
- [x] fixed · reuse (structure agent) · `settle-payouts-form.tsx:46` + 3 copies · `${investmentId}:${workerId}` pair key built in 4 places — `pairKey` in `lib/kosztorys/worker-payout-pairs.ts`, used by the form, schema, fold and settle action
- [x] dropped · module-cohesion · `src/lib/auth/roles.ts:28` · `BONUS_FORBIDDEN_MESSAGE` beside its predicate — matches the majority pattern (`investment-lock.ts`, `cash-register-lock.ts`)
- [x] fixed · comment-noise · 6 deletes (`subcontractor-summary.ts:52`, `subcontractor-worker-totals.tsx:77`, 4 test comments restating their `it` title) + 2 trims (`book-overpayment-bonus.test.ts:44`, `db/worker-payout-pairs.test.ts:152`) — applied
- [x] fixed · comment-noise · judgment deletes: `summary-panel-content.tsx:81`, `subcontractor-summary.tsx:19,60`, `worker-view/summary.ts:22`, `subcontractor-summary.test.tsx:202` (Polish — breaks the English-comments rule), `subcontractor-summary.test.ts:264`, `shape-investments.test.ts:600`, `validate-hook.test.ts:123`; move `book-overpayment-bonus.test.ts:14` onto the describe — deleted `subcontractor-summary.test.ts:264`, `shape-investments.test.ts:600`; translated the Polish one to English; moved the :14 comment; kept `summary-panel-content.tsx:81` / `subcontractor-summary.tsx:19` (each `PropsT` documents every prop), `subcontractor-summary.tsx:60`, `worker-view/summary.ts:22`, `validate-hook.test.ts:123` (each says why: premia is not cash / one line not itemised / settles one pair)
- [x] dismissed · comment-noise · `settle-payouts-form.tsx:66` `pairNames` prop doc — every prop in that `PropsT` carries a one-line doc; deleting one breaks the set
- [x] dismissed · tailwind-v4-audit · clean — 0 findings
- [x] dismissed · feature-first-structure · clean — 0 findings
- [x] fixed · simplify (efficiency) · `settle-payouts-form.tsx:137,182` · `router.refresh()` after a revalidating action renders the route a second time (lessons EX-908) — both removed
- [x] fixed · simplify (efficiency) · `settle-payouts-form.tsx` `reload` · the kasa balance was re-read on every reload, a premia's included (it moves no kasa) — moved to the stale path only
- [x] fixed · simplify + altitude + reuse-scan · `margin-actual-table.tsx:45`, `shape-investments.ts:106` · the investment-level „Pozostało" written twice from the same `(financials, settlement)` — `subcontractorRemaining` beside `marginV2` in `lib/kosztorys/margin-v2.ts`
- [x] dropped · simplify + altitude + reuse-scan · 5 per-row „Pozostało" sites (`worker-payout-pairs.ts:51`, `subcontractor-summary.ts:121,148,178`, `worker-view/summary.ts:81`) · a helper over `(due, bonus, paid)` only restates the arithmetic, and a new term would still touch every call site
- [x] fixed · simplify · `book-overpayment-bonus.ts:57` · optional-chain cascade over a maybe-missing pair — early stale return, then plain reads
- [x] dropped · simplify + reuse-scan · `{ success: false, stale: true, error: STALE_PAIR_MESSAGE }` ×3 — the message is already shared; a constant for the literal is churn
- [x] fixed · simplify + reuse-scan · `subcontractor-worker-totals.tsx:76` · `roundToCents(row.remaining)` on a figure already rounded in `subcontractor-summary.ts:121` — wrap and import removed
- [x] fixed · simplify · `subcontractor-worker-totals.tsx:73` · dialog target held in state though every field comes from props — `isSettleOpen` boolean
- [x] fixed · simplify · `settle-payouts-form.tsx:167,264` · `pairNames(bonusRow)` called twice; `bookBonus` three-way branch with a duplicated `setIsBooking(false)` exit — names read once, one exit
- [x] dropped · simplify · `SettlePayoutsForm` takes 3 target-derived props instead of the target — pre-existing shape, not this slice's
- [x] fixed · reuse-scan · `expense-type-role-gate.test.tsx:19`, `deposit-type-role-gate.test.tsx:19` · `referenceDataFor` verbatim copy — `src/__tests__/helpers/reference-data.ts`
- [x] fixed · reuse-scan · `book-overpayment-bonus.test.ts:48`, `settle-payouts.test.ts:52` · `remainingOf` copy — `src/__tests__/helpers/pair-remaining.ts`
- [x] dropped · altitude · `print/worker.ts:33`, `worker-summary.tsx:68` · the worker balance footer built twice — predates the slice, 4 rows
- [x] dismissed · reuse-scan · locked-investment refusal text ×2, Premia row via `SummaryRow`, column-template builder ×2 — two sites each; `SummaryRow` would break the files' hand-written-row style
- [x] dismissed · altitude · PAYOUT/BONUS split in 3 consumers, premia rule moved into `TRANSFER_TYPE_SPECS`, role check in the validate hook — a split reader threads a second field through 4 layers; the spec-table move would change COMPANY_FUNDING (EX-557); gating belongs in the action

## Simplify pass

Ran /simplify (efficiency, simplification, altitude, reuse + primitive scan) — 10 applied, 0 proposed, 7 dropped/dismissed; each folded into `## Findings`. Green after: tsc clean, 19 unit/DOM files 181 tests, 2 DB files 14 tests.

## Tests & suite

- E2E (plan § E2E, settle-dialog premia end to end): filed EX-980 (`e2e-backlog`).
- Fast legs after simplify: tsc clean · 19 unit/DOM files 181 passed · 2 DB files 14 passed.
- Full suite: skipped by user (fast legs judged enough; pre-push runs the unit leg).
