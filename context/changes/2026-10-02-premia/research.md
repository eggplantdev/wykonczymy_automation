---
date: 2026-10-02T11:20:00+0200
researcher: Claude (Opus 5.5)
git_commit: 8b548989e5d34a5f7130cf5c3fcf77c3ce25f769
branch: staging
repository: wykonczymy
topic: "Premia (EX-979) — settling a worker's overpayment as a bonus, invisible to the investor"
tags:
  [
    research,
    codebase,
    transfers,
    payouts,
    worker-payout-pairs,
    subcontractor-due,
    margin-v2,
    client-view,
  ]
status: complete
last_updated: 2026-10-02
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Open questions resolved by the owner'
---

# Research: Premia — settling a worker's overpayment as a bonus

**Date**: 2026-10-02T11:20:00+0200
**Git Commit**: 8b548989
**Branch**: staging
**Repository**: wykonczymy

## Research Question

A worker on one investment has „Suma wykonanej pracy" 10 090,80, „Zaliczki (wypłaty)" 10 295,81 →
„Pozostało do wypłaty" −205,01 („nadpłacone", „Wypłacono więcej niż wykonano"). The owner wants the
surplus booked as a **premia**, invisible to the investor. Owner rulings (2026-10-02): the investor
does not see the owner's sheet; a premia is not always tied to an investment; a MANAGER may grant one.

Candidates examined:

- **A** — a kosztorys pozycja „Premia": Cena j.m. 0 zł, kwota stała for the worker.
- **B** — a new non-cash transfer type `BONUS`: no kasa, worker required, investment optional; it adds
  to what the worker is owed.
- **C** — a `PAYOUT` carrying a „premia" flag, excluded from zaliczki.

## Summary

1. **B is the only fail-closed design.** No investor surface reads a transfer type it is not wired to:
   the share page / podgląd inwestora render only named buckets (robocizna from the kosztorys, rabat,
   strata, wpłaty, materiały); the offer PDF and the review email read no transactions at all. A new
   type in a new bucket stays invisible unless someone wires it in.
2. **A fails open and is ruled out.** A pozycja with executed qty is not „empty", so it shows on the
   share grid, in the offer PDF, on the protokół odbioru the investor signs, and stays in the share
   link's version history even after deletion. It cannot exist without an investment, misattributes
   across a shared etap, and raises three permanent diagnostics.
3. **C is wrong for this case.** The 205,01 already left the kasa as wypłaty; a new flagged PAYOUT
   drains the kasa a second time, so C only works by splitting an existing PAYOUT row — editing the
   audit trail. It also needs a schema flag and a golden-master hash change on top of B's work.
4. **The real work is not the type — it is the five places that compute „Pozostało do wypłaty"**,
   each independently keyed on `'PAYOUT'` / the `payouts` bucket. A premia must enter all five as
   `owed = due + Σ premia − Σ wypłat`, or the listing, the Podwykonawcy tab, `/pracownicy`, the
   „Rozlicz wypłaty" dialog and the worker's own link disagree.
5. **Marża: v2 must drop, v1 must not.** v1 already subtracted the 205,01 through the PAYOUT
   (`calculate-margin.ts`), so v1 must not read BONUS (double count). v2 reads `należne` instead of
   wypłaty and **today does not see the overpayment at all** — a BONUS term makes v2 pay for it exactly
   once. That needs a new financial bucket `bonus`; mapping it onto `loss` or `discount` would raise
   the investor's bilans and print on the protokół.
6. **A premia without an investment moves no figure under any design.** Every „Pozostało" figure is
   per investment × worker and never nets across investments (owner, 2026-09-29). And a cash premia
   with no investment is **already booked today** as a `PAYOUT` without investment (26 such rows
   locally — salary, loans, gifts, fuel, premie), which is deliberately outside „Pozostało". So the
   two meanings of „premia" split cleanly — see Open Questions.

## Detailed Findings

### 1. Investor visibility (what the investor can see)

| Surface                                                                                           | Reads transactions? | B / C                                                                                                                        | A („Premia" pozycja, 0 zł)                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/k/[token]` + podgląd inwestora (`src/lib/queries/preview-kosztorys.ts:49-88`)                   | yes, per-type sums  | never rendered — Podwykonawcy / Marża are `clientVisible: false` (`src/components/kosztorys/summary/summary-views.ts:26-35`) | **shown** — `client-empty` hides only rows empty on both axes (`src/lib/kosztorys/row-conditions/registry.ts:358-370`); no per-row hide flag exists |
| „Pokaż wszystkie pozycje" (`preview-header-actions.tsx:54`)                                       | —                   | —                                                                                                                            | reveals even an empty row                                                                                                                           |
| version history on the share link (`k/[token]/page.tsx:22-23`)                                    | no                  | —                                                                                                                            | deleting the row does not remove it from past versions                                                                                              |
| offer PDF (`src/lib/kosztorys/print/offer.ts:35-65`)                                              | no                  | never                                                                                                                        | shown if przedmiar > 0 or etap qty > 0                                                                                                              |
| protokół odbioru (`src/lib/kosztorys/acceptance-protocol/scope-rows.ts:7-21`, `settlement.ts:77`) | wpłaty + strata     | never — **unless BONUS were mapped to `loss`**                                                                               | listed as signed scope („Premia — 1 szt.")                                                                                                          |
| review-request email (`review-request-email.ts:12-29`)                                            | no                  | never                                                                                                                        | never                                                                                                                                               |
| owner's sheet „transfery" tab                                                                     | PAYOUT syncs        | B: `transfersSheetTab: false` → nothing; C lands in the PAYOUT SUMIF                                                         | —                                                                                                                                                   |

Owner ruling: the investor does not see the owner's sheet, so sheet sync is a bookkeeping choice,
not a visibility one.

### 2. The five „Pozostało do wypłaty" computations

Each is independent; a design must change all five in one step.

1. **Podwykonawcy tab** — `src/lib/kosztorys/subcontractor-summary.ts:116` (row: `due − paid`),
   `:137` (headline: `dueNet − payoutsTotal`), state `:57-69` (`overpaid` = remaining < 0 && due > 0).
   Data: `src/lib/db/get-payout-transactions.ts:20-27` (`type = 'PAYOUT' AND investment_id`), summed by
   `derivePayoutsByWorker` (`src/lib/kosztorys/payouts-by-worker.ts:29-44`). Labels in
   `src/components/kosztorys/summary/blocks/subcontractor-worker-totals.tsx:31,43-53`.
2. **„Rozliczenie z ekipą"** on the Marża tab —
   `src/components/kosztorys/summary/tabs/margin-actual-table.tsx:44` (`due − totalPayouts`), `:109`.
3. **Investments listing** — `src/lib/queries/shape-investments.ts:103-106`
   (`settlement.due − financials.totalPayouts`); `due` from SQL
   `src/lib/db/kosztorys-subcontractor-due.ts:79-94`.
4. **Worker × investment pairs** — `src/lib/db/worker-payout-pairs.ts:46-53`
   (`WHERE t.type = 'PAYOUT'`, `JOIN investments` → payouts without investment excluded `:18-20`),
   folded by `src/lib/kosztorys/worker-payout-pairs-fold.ts:21-60`, classified by `classifyPair`
   (`src/lib/kosztorys/worker-payout-pairs.ts`). Feeds `/pracownicy` (`src/components/tables/users.tsx`
   via `src/lib/queries/balances.ts:135-145`), the „Rozlicz wypłaty" dialog
   (`src/lib/queries/settle-payouts.ts:44`) and `settlePayoutsAction`'s uncached re-read
   (`src/lib/actions/settle-payouts.ts:71`). Invariant: Σ pairs = listing cell (parity spec).
5. **Worker's own link / PDF** — `src/lib/kosztorys/worker-view/summary.ts:62-97`
   (`owed = executedNet − paidNet`), rendered by `worker-summary.tsx:64-82` and mirrored in
   `src/lib/kosztorys/print/worker.ts:33-74`. **The worker sees „Nadpłata 205,01" today**, plus every
   payout row with its opis. Cache key `worker-kosztorys-data-v4` (`src/lib/queries/worker-kosztorys.ts`).

Under B: rows 1–5 become `due + Σ BONUS − Σ PAYOUT` per worker (pair grain). Keep `due` itself free of
the premia, or „Podział etapów" column totals stop equalling „Suma wykonanej pracy"
(`subcontractor-stage-breakdown.ts:28-61`). `settlementState` must test `due + bonus`, or a worker with
only a premia reads `no_stages`. The settle dialog flips Roman's pair to `settled` for free once
`classifyPair` includes the bonus — an `overpaid` pair is not blocked today, only shown unticked
(`settle-payouts-form.tsx:32-40`).

### 3. Financial figures

- **Marża v1** — `src/lib/db/calculate-margin.ts:16-22`: robocizna − wypłaty − rabat − strata − …
  B: unchanged and correct (the cash was already a PAYOUT). Must **not** read BONUS.
- **Marża v2** — `src/lib/kosztorys/margin-v2.ts:28-40`: robocizna − rabat − należne − wliczone −
  strata; `null` when an etap lacks a settlement plane. B: subtract `totalBonus` here (single place —
  the listing calls the same TS function with SQL `due`). Rationale for v2 using `due` instead of
  wypłaty: `context/foundation/investment-financials-and-discount.md:130-166` (EX-649).
- **Financials plumbing** — new `FinancialBucketT` member `bonus`; `InvestmentFinancialsT.totalBonus`,
  `ZERO_FINANCIALS`, `deriveFinancials` (`src/lib/db/investment-financials.ts:101-117`).
  `financialBucketOf` falls back to `'none'` for an unmapped type — fail-open, a mis-wired type
  vanishes from every total silently.
- **Bilans v1/v2, „Robocizna v1/v2", reconciliation, margin forecast** — none read a `bonus` bucket;
  none should move. Do **not** map BONUS to `loss` (raises bilans, prints on the protokół) or
  `discount` (raises bilans).
- **Kasy** — balances computed on read in `src/lib/db/sum-transfers.ts:33-94`, any non-deposit row
  with a register is `ELSE −amount`. BONUS with `sourceRegister: 'never'` is nulled by
  `src/hooks/transfers/validate.ts:143-145` → touches no kasa (confirmed).
- **Transfer list total tile** (`transfer-table-server.tsx:61-63`) sums every type unsigned — BONUS
  inflates it the same way LABOR_COST / LOSS already do. Pre-existing, not new.
- **Company level** — there is no company P&L; `/raporty` is off (EX-598). An investment-less row is
  visible only in the transfer list and on the worker page.
- **Golden master** (`src/__tests__/financial-golden-master-db.test.ts:126-141, 307-322`) — hashes
  type/amount/worker per row, so BONUS rows change the hash naturally; add `totalBonus` to the
  snapshot.

### 4. Adding the type — plumbing inventory

- **Spec table** `src/lib/constants/transfers.ts`:
  - `TRANSFER_TYPES` L2-16 is sorted by Polish label, test-enforced → „Premia" sits between Koszty
    robocizny and Rabat.
  - The spec row: `label 'Premia'`, `deposit false`, `expensesSheetTab false`,
    `transfersSheetTab false`, `settleable false`, `financialBucket 'bonus'`,
    `billedAmount 'amount'`, `sourceRegister 'never'`, plus a free chart colour.
  - Add BONUS to `TRANSACTION_TRANSFER_TYPES` L297-306 and `INVESTMENT_TYPES` L506-515 (without it the
    validate hook strips the investment silently).
  - Leave it out of `REQUIRES_INVESTMENT_TYPES`, per the owner.
  - Extend `needsWorker` L538 (PAYOUT-only today).
  - `showsOtherCategory` L547 is a choice.
- **Collection** `src/collections/transfers.ts`:
  - Add an option at L19-39; `_AllTransferTypesCovered` L44-48 fails compilation without it.
  - The worker field condition L205-213 is **hardcoded `=== 'PAYOUT'`**, not `needsWorker` — switch
    it to the predicate.
- **Migration**:
  - `ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'BONUS'`, alone in its own migration
    (Postgres can't use a new enum value in the transaction that added it).
  - Patterns: `src/migrations/20260611_1_add_loss_enum.ts`,
    `src/migrations/20260726_0_add_investment_expense_net_type.ts`.
  - No CHECK constraints on transactions; the `(worker_id, type)` index covers it.
  - Additive → prod migrate before push (human).
- **Validation**:
  - `src/hooks/transfers/validate.ts:171-177` requires/strips the worker by `needsWorker`; the message
    at L172 says "payout".
  - `src/lib/schemas/transfer-validation.ts:61` says „dla wypłaty".
  - Both need generalising.
  - `getAmountError` already demands positive.
- **Roles**:
  - `protectedAction` (`src/lib/actions/run-action.ts:84`) admits ADMIN/OWNER/MANAGER, and no create
    path gates per type, so MANAGER can book BONUS with no change (matches the owner ruling).
  - Edit/cancel follows `canMutateTransfer` (`src/lib/auth/roles.ts:42-52`): ADMIN/OWNER, or the
    creator.
- **Forms**:
  - `src/components/forms/expense-form/expense-form.tsx` (type list L283, worker combobox L341,
    register L317) is driven by the predicates.
  - Edit dialog, table colour and transfer text pick it up from the maps.
- **Hardcoded `types: ['PAYOUT']` drill-downs**: `subcontractor-worker-totals.tsx:86`,
  `subcontractor-payouts-table.tsx:93`.
- **Worker page** `src/app/(frontend)/pracownicy/[id]/page.tsx:59` — „Wypłaty" sums PAYOUT only.
  BONUS appears in his transfer list; a „Premie" figure is optional.
- **Sheet sync** — `SHEET_SYNCED_TYPES` (`src/hooks/transfers/sync-sheet.ts:20`) skips a type in
  neither tab list silently. That is the intended outcome with both flags false, and it keeps the
  frozen `TRANSFERS_SUMMARY_TYPES` column layout (`context/foundation/lessons.md:12-16`) untouched.
- **Cancellation / trash / cache**:
  - Cancellation and trash are generic.
  - `recalculate-balances` revalidates `transfers` for every type, and every affected read carries
    that tag.
  - Bump the cache keys whose payload shape changes: `worker-payout-pairs-v2`,
    `payout-transactions`, `worker-kosztorys-data-v4`.
- **Tests to touch**:
  - spec table and constants: `transfer-spec-table.test.ts`, `transfer-constants.test.ts` (truth
    table, exact arrays, Polish sort order)
  - validation, schema and totals: validate-hook, transfer-schema, clear-fields-for-type,
    sum-transfers, derive-financials-bucketing
  - „Pozostało" figures: worker-payout-pairs DB parity, get-payout-transactions,
    subcontractor-summary, settle-payouts
  - golden master
- **Not touched** — notifications, the Facebook webhook and `src/lib/ai` (receipt OCR only) don't
  read types.

### 5. Design A specifics (for the record)

- Pricing precedence is mnożnik > kwota stała > auto (`src/lib/kosztorys/calc.ts:127-140, 185-194`;
  SQL mirror `kosztorys-subcontractor-due.ts:38-53`). At Cena j.m. 0 the ceiling guard is inert
  (`subcontractor-price-guard.ts:66`), so a kwota stała of 205,01 saves cleanly.
- Attribution: inside a shared etap `splitStagePool` (`stage-split.ts:39-59`) splits the premia across
  every worker on that etap; it reaches only Roman in a dedicated etap — which then becomes a column
  the investor sees.
- Diagnostics: `no-client-price-with-work` (red, `registry.ts:376-385`),
  `work-without-planned-qty`, and „spoza katalogu prac".

## Code References

- `src/lib/constants/transfers.ts:2-83, 297-306, 506-548` — type list, spec table, dialog list, field predicates
- `src/collections/transfers.ts:19-48, 205-213` — options, exhaustiveness check, hardcoded worker condition
- `src/hooks/transfers/validate.ts:143-177` — register/investment/worker strip-or-require
- `src/lib/db/sum-transfers.ts:33-94` — kasa balances, `ELSE −amount`
- `src/lib/db/investment-financials.ts:101-117` — `deriveFinancials` buckets
- `src/lib/db/calculate-margin.ts:16-22` — marża v1
- `src/lib/kosztorys/margin-v2.ts:28-40` — marża v2
- `src/lib/kosztorys/subcontractor-summary.ts:57-69, 116, 137` — Podwykonawcy rows/headline/state
- `src/lib/db/get-payout-transactions.ts:20-27` — per-investment PAYOUT rows
- `src/lib/db/worker-payout-pairs.ts:18-53` — pair SQL; `src/lib/kosztorys/worker-payout-pairs.ts` — `classifyPair`
- `src/lib/queries/shape-investments.ts:103-106` — listing „Pozostało"
- `src/components/kosztorys/summary/tabs/margin-actual-table.tsx:44` — „Rozliczenie z ekipą"
- `src/lib/kosztorys/worker-view/summary.ts:62-97`, `src/lib/kosztorys/print/worker.ts:33-74` — worker's own summary/PDF
- `src/lib/actions/settle-payouts.ts:37-127` — „Rozlicz wypłaty" (books PAYOUT only)
- `src/lib/kosztorys/row-conditions/registry.ts:358-385` — `client-empty`, price diagnostics

## Architecture Insights

- **Entitlement vs cash is the right split.** The app already separates what is owed (kosztorys
  `due`) from what was paid (PAYOUT). A premia is an entitlement, not cash. B adds a second source of
  entitlement beside `due`, and leaves all cash on PAYOUT. That is accrual accounting in miniature:
  LABOR_COST / RABAT already play the same role on the investor side.
- **Same pattern as the existing non-cash types.** LABOR_COST, RABAT and LOSS are all
  `sourceRegister: 'never'`.
- **Investor isolation is structural, not filtered.** Investor surfaces enumerate what they render
  (named buckets, client-visible summary tabs), so a new type is invisible by default. A's failure is
  the opposite pattern: the kosztorys grid renders everything and subtracts via conditions —
  fail-open (`lessons.md` „A disclosure setting subtracts from a code ceiling, and fails CLOSED").
- **Duplicated formula, five homes.** „Pozostało do wypłaty" has two TS folds and two SQL paths plus
  the worker view. Any change to it is a five-site change guarded by parity specs (test-plan risks #1,
  #16).

## Historical Context (from prior changes)

- `context/archive/2026-09-29-worker-payout-remaining/change.md:20-72`:
  - Pair grain; no netting across investments.
  - Payouts without an investment stay outside the figure; this is where premie live today.
  - No „na etacie" flag.
  - „Zaliczka" kept as the word for paying ahead.
- `context/archive/2026-09-30-settle-payouts-pool/change.md` — „Rozlicz wypłaty" dialog: whole-batch
  stale refusal; paying ahead is explicit; MANAGER has access.
- `context/archive/2026-08-12-strata-obniza-bilans/change.md` (EX-675) — precedent for a non-cash
  type and for reading the owner's intent from the type he picked.
- `context/archive/2026-08-12-ex-557-legacy-deposit-types/change.md` — client-side role gate deemed
  sufficient (not needed here: MANAGER is allowed).
- `context/archive/2026-07-25-transfer-type-spec-table/change.md:35-42` — every type must be
  classified on every spec axis; giving a type a register silently debits kasy.
- `context/archive/2026-08-18-marza-prognoza-rzeczywista/review-gate.md:38-40` — EX-906 (open): three
  words for one overpaid state („Nadpłata" / „nadpłacone" / „Wypłacono więcej niż wykonano").
- `context/domain/02-glossary.md:30-61` — Category B → identifier `bonus` / `BONUS`, UI „Premia". No
  glossary row yet; add one.
- No roadmap slice or PRD item covers worker bonuses or payroll.

## Related Research

- `context/changes/2026-10-02-investments-listing-no-kosztorys-figures/` — **in flight, same file**:
  also edits `subcontractorRemaining` in `shape-investments.ts`. Sequence the two changes; don't
  interleave.

## Open Questions

Owner decisions only; everything checkable in code is answered above.

1. **Two meanings of „premia nie zawsze związana z inwestycją".**
   - **Today:** a premia paid in cash outside any investment is already booked as a wypłata without an
     investment. It leaves the kasa and stays outside „Pozostało".
   - **BONUS without an investment** would be a non-cash row that moves no figure: no kasa, no pair, no
     marża. It would only be a note.
   - **Options:** (a) keep investment-less premie as wypłata-bez-inwestycji and have BONUS only correct
     an inwestycja × pracownik; (b) allow BONUS without an investment as a pure record; (c) let BONUS
     optionally take a kasa. With a kasa it is entitlement and cash at once, so it nets to zero on
     „Pozostało", drains the kasa and lowers marża v2. That one type would then cover „premia paid out
     on top of the work" too, which today would show as an overpayment.
2. **What the worker sees.** Today Roman's link/PDF shows „Nadpłata 205,01". Under B it would show a
   „Premia 205,01" line and settle to 0. Should the premia be shown to him, or should his summary just
   settle without naming it?
3. **Booking path.** Book a premia only from the general transfer dialog? Or also offer a one-click
   „Wyrównaj nadpłatę premią" on an overpaid pair (Podwykonawcy tab / „Rozlicz wypłaty")? The one-click
   path would prefill the amount, and should re-read the pair under `lockInvestmentGates`, like
   `settlePayoutsAction`, so it can't race a concurrent wypłata.

## Follow-up 2026-10-02 — owner answers

1. **(a)** An investment-less premia stays a `PAYOUT` without investment, as today. `BONUS` exists only
   to correct an inwestycja × pracownik pair → **investment required** (`REQUIRES_INVESTMENT_TYPES`),
   no kasa, worker required. This supersedes „investment optional" above.
2. **Separate line**: the worker's link/PDF shows „Premia" as its own line between „Wykonane razem" and
   „Wypłacone"; „Pozostało" = wykonane + premia − wypłacone.
3. **Both paths**: the general transfer dialog AND a one-click „Wyrównaj nadpłatę premią" on an
   overpaid pair, amount prefilled with the overpayment, re-read under `lockInvestmentGates` with
   stale refusal (same contract as `settlePayoutsAction`).
