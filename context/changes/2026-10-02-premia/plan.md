# Premia (BONUS) Implementation Plan

## Overview

A new non-cash transfer type `BONUS` („Premia") that raises what a worker is owed on one
investment × worker pair without touching any kasa and without reaching any investor surface. It
settles an overpaid pair (Σ wypłat > wykonana praca) — the Roman Pavlovsky case, −205,01 zł — and is
booked either from the general transfer dialog or with one click on an overpaid row of the
„Rozlicz wypłaty" dialog, which the Podwykonawcy tab now opens too. Linear: EX-979.

## Current State Analysis

Full grounding in `research.md`. The load-bearing facts:

- „Pozostało do wypłaty" is computed independently in five places, each keyed on `'PAYOUT'` / the
  `payouts` bucket: the Podwykonawcy tab (`subcontractor-summary.ts:116,137`), „Rozliczenie z ekipą"
  (`margin-actual-table.tsx:44`), the investments listing (`shape-investments.ts:103-106`), the
  worker × investment pairs (`db/worker-payout-pairs.ts:46-53` → `classifyPair`) feeding `/pracownicy`,
  the „Rozlicz wypłaty" dialog and `settlePayoutsAction`, and the worker's own link/PDF
  (`worker-view/summary.ts:62-97`, `print/worker.ts:33-38`).
- The per-investment row source for the Podwykonawcy tab and the worker link is ONE query,
  `getPayoutTransactionsForInvestment` (`db/get-payout-transactions.ts`), and `payouts-by-worker.ts`
  forbids splitting it into a second one. It is fetched only by the owner's kosztorys page and the
  worker link — never by the investor share path.
- Marża v1 (`calculate-margin.ts`) already paid for the overpayment through the PAYOUT; marża v2
  (`margin-v2.ts`) reads `należne` instead of wypłaty and does not see it.
- Non-cash types (`LABOR_COST`, `RABAT`, `LOSS`) use `sourceRegister: 'never'`; the validate hook
  nulls the register, so `sum-transfers` never debits a kasa for them.
- A locked (zakończona / trashed) investment already refuses every transfer write
  (`hooks/transfers/validate.ts:76-77`, `actions/transfers.ts`).
- `settlePayoutsAction` (`actions/settle-payouts.ts`) is the contract for a booking sized off a pair:
  `lockInvestmentGates` → uncached `selectWorkerPayoutPairs` re-read → stale refusal.
- The sibling change `investments-listing-no-kosztorys-figures` (committed on its branch, in review
  gate) already rewrote `subcontractorRemaining` in `shape-investments.ts`; this plan only adds the
  bonus term to the line it left behind.

## Desired End State

- `BONUS` exists end to end: enum value, collection option, spec row, dialog entry. Worker and
  investment are required, kasa is impossible.
- On every one of the five surfaces, a pair's figure is `wykonana praca + premia − wypłaty`; Roman's
  pair reads 0,00 / „rozliczone" after a 205,01 premia, everywhere at once.
- Marża v2 drops by Σ premii; marża v1, both bilanse, robocizna v1/v2, kasy, the investor share,
  offer PDF, protokół odbioru and the owner's sheet are unchanged by a premia.
- The worker's link and PDF print a „Premia" line between „Wykonane razem" and „Wypłacone".
- An overpaid row of the „Rozlicz wypłaty" dialog offers „Wyrównaj premią", which books exactly the
  overpayment after a confirm, refusing if the figure moved. The dialog behaves the same from all
  three entry points: `/pracownicy` (one worker), the investments listing and the Podwykonawcy tab
  (one investment).

### Key Discoveries:

- `classifyPair` is the single classifier for every pair surface (`kosztorys/worker-payout-pairs.ts:41`)
  — adding the bonus there moves the employee column, both dialog entry points and the action together.
- `deriveFinancials` buckets by `financialBucketOf`, which falls back to `'none'`
  (`db/investment-financials.ts:71-72`) — a new bucket must be wired explicitly or BONUS vanishes.
- `financialsOnReading` spreads financials (`kosztorys/summary-reading.ts:55`), so `totalBonus` flows
  to the rebased figures with no change there.
- The worker field condition in the collection is hardcoded `data?.type === 'PAYOUT'`
  (`collections/transfers.ts:211`) and the two validation messages say „wypłata"
  (`hooks/transfers/validate.ts:172`, `lib/schemas/transfer-validation.ts:61`).
- `ConfirmDialog` exists in `src/components/ui/confirm-dialog.tsx`.

## What We're NOT Doing

- A BONUS without an investment — an investment-less premia stays a `PAYOUT` without investment
  (owner, decision 1a).
- A BONUS that moves cash — the kasa side of any premia stays a `PAYOUT`.
- Netting a premia across investments — pairs never net (owner, 2026-09-29).
- Sheet sync for BONUS (`transfersSheetTab: false`, `expensesSheetTab: false`); the frozen
  `TRANSFERS_SUMMARY_TYPES` layout is untouched.
- A „Premie" figure on `/pracownicy/[id]` — the rows appear in their transfer list; nothing else.
- A one-click premia outside the „Rozlicz wypłaty" dialog — one behaviour, one home (owner,
  2026-10-02); the Podwykonawcy tab reaches it by opening the dialog.
- An editable amount on the one-click path — it books the overpayment exactly; any other amount goes
  through the general dialog.
- Listing the premia's opis/date on the worker's link — they see one „Premia" total.
- EX-906 (three words for one overpaid state).

## Implementation Approach

Entitlement vs cash: the kosztorys `due` is the entitlement, PAYOUT is the cash. BONUS is a second
entitlement source beside `due`, so it never enters `due` itself (the „Podział etapów" column totals
must keep equalling „Suma wykonanej pracy") — it is a separate term every „Pozostało" adds. On the
financials side it gets its own bucket `bonus` and figure `totalBonus`, read by marża v2 only.

Order: the type and its financial bucket first (phase 1), then all five „Pozostało" sites in one
phase so they cannot disagree at any commit (phase 2), then the worker's view (phase 3), then the
one-click premia in the settle dialog (phase 4), then the living docs (phase 5).

## Critical Implementation Details

**The enum value must ship alone in its own migration.** Postgres refuses to use an enum value in the
transaction that added it; copy `src/migrations/20260611_1_add_loss_enum.ts`, register it in
`src/migrations/index.ts`, name it after the latest (`20261002_3_add_bonus_transfer_type.ts`). Additive:
a human runs `pnpm db:migrate:prod` **before** the push. Run `git status src/migrations` before any
local migrate — the tree is shared.

**Cache shape bumps.** Every `unstable_cache` entry whose cached value changes shape gets its `-vN`
key bumped in the same commit, or a pre-deploy entry deserializes without the new field and the
figure reads `NaN` / ignores the premia: the payout rows (`payout-transactions`), the pair rows
(`worker-payout-pairs-v2`, `queries/balances.ts:143`), the worker data (`worker-kosztorys-data-v4`),
and any entry that caches a whole `InvestmentFinancialsT` rather than raw type totals (check
`preview-kosztorys-editor-data-v4` and the financials maps in `queries/balances.ts`).

---

## Phase 1: The BONUS type and its financial bucket

### Overview

BONUS is bookable from the general dialog with worker + investment required and no kasa; it lands in
a new `bonus` bucket; marża v2 subtracts it, nothing else reads it.

### Changes Required:

#### 1. Enum migration

**File**: `src/migrations/20261002_3_add_bonus_transfer_type.ts` (+ `src/migrations/index.ts`)

**Intent**: Add the value the column must accept.

**Contract**: `ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'BONUS'`, alone; `down` is a
no-op like the LOSS precedent. Then `pnpm generate:types` (gitignored output).

#### 2. Spec table and predicates

**File**: `src/lib/constants/transfers.ts`

**Intent**: Classify BONUS on every axis so the compiler and the truth-table tests own it.

**Contract**:

- `TRANSFER_TYPES`: `'BONUS', // Premia` between `LABOR_COST` and `RABAT` (Polish sort).
- New `financialBucket` member `'bonus'`.
- Spec row: label `'Premia'`, a free chart colour, `deposit false`, `expensesSheetTab false`,
  `transfersSheetTab false`, `settleable false`, `financialBucket 'bonus'`, `billedAmount 'amount'`,
  `sourceRegister 'never'` (with a one-line why, like LOSS).
- Add to `TRANSACTION_TRANSFER_TYPES`, `INVESTMENT_TYPES`, `REQUIRES_INVESTMENT_TYPES`.
- `needsWorker` → PAYOUT or BONUS. `showsOtherCategory` unchanged (BONUS has none).

#### 3. Collection and validation

**Files**: `src/collections/transfers.ts`, `src/hooks/transfers/validate.ts`,
`src/lib/schemas/transfer-validation.ts`

**Intent**: The admin option, the worker field and both validation layers treat BONUS like PAYOUT for
the worker.

**Contract**: option `{ en: 'Bonus', pl: 'Premia' }`; worker `condition` reads `needsWorker`; both
„worker required" messages stop naming the wypłata („Pracownik jest wymagany dla tego typu" /
"Worker is required for this transfer type").

#### 4. Financials

**Files**: `src/types/investment-financials.ts`, `src/lib/db/investment-financials.ts`,
`src/lib/kosztorys/margin-v2.ts`, `src/components/kosztorys/summary/tabs/margin-actual-table.tsx`

**Intent**: Carry Σ premii as its own figure and charge it to marża v2 exactly once.

**Contract**:

- `InvestmentFinancialsT.totalBonus: number`, `ZERO_FINANCIALS.totalBonus: 0`,
  `deriveFinancials` → `totalBonus: sumBucket(rows, 'bonus')`.
- `marginV2` subtracts `financials.totalBonus`; its doc comment names why v1 must not (the
  overpayment already left as a PAYOUT).
- „Marża rzeczywista" table: a „Premia" row (`−totalBonus`) when ≠ 0, and `DESCRIPTION` mentions it.
- `calculateMargin` (v1) and `calculateBalance` untouched.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)
- Spec/constants truth tables updated and green: `pnpm exec vitest run src/__tests__/lib/constants/transfer-spec-table.test.ts` and the `transfer-constants` spec
- Validate-hook, transfer-schema and clear-fields-for-type specs cover BONUS: worker + investment required, register nulled
- `derive-financials-bucketing` spec: BONUS → `totalBonus` only; `totalPayouts`, `totalLoss`, `totalDiscount` and `calculateBalance` unchanged
- `margin-v2` spec: v2 drops by the bonus; `calculate-margin` v1 spec unchanged with a BONUS row present
- `sum-transfers` spec: a BONUS row moves no kasa balance

#### Manual Verification:

- „Nowa transakcja" → „Premia" shows worker + investment, no kasa; saving without a worker is refused with the new message
- A booked premia leaves every kasa balance unchanged

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: „Pozostało do wypłaty" counts the premia on all owner surfaces

### Overview

The four owner-side sites move together: pairs (→ `/pracownicy`, „Rozlicz wypłaty", the action),
the Podwykonawcy tab, „Rozliczenie z ekipą", the listing.

### Changes Required:

#### 1. Pair read and classifier

**Files**: `src/lib/db/worker-payout-pairs.ts`, `src/lib/kosztorys/worker-payout-pairs-fold.ts`,
`src/lib/kosztorys/worker-payout-pairs.ts`, `src/lib/queries/balances.ts`

**Intent**: Each pair carries its premia and every classification counts it.

**Contract**:

- The paid query reads `type IN ('PAYOUT','BONUS')` and returns `paid` and `bonus` as two
  `FILTER`ed sums; `PaidRowT` and `WorkerPayoutPairRowT` gain `bonus: number`.
- `classifyPair`: `remaining = due + bonus − paid`. `hasFigures` also counts a non-zero bonus.
  `SettleRowT` gains `bonus`.
- Cache key `worker-payout-pairs-v2` → `-v3`.

#### 2. Settle dialog column

**File**: `src/components/forms/settle-payouts-form/settle-payouts-table.tsx`

**Intent**: A row must still tally on screen once `remaining` includes a premia.

**Contract**: a „Premia" column between „Wykonane" and „Wypłacone", rendered only when some row has
a non-zero bonus (same „only when ≠ 0" rule the margin table uses for Rabat).

#### 3. Per-investment rows and the Podwykonawcy tab

**Files**: `src/lib/db/get-payout-transactions.ts`, `src/types/transfers.ts`,
`src/lib/queries/investment-transactions.ts`, `src/lib/kosztorys/payouts-by-worker.ts`,
`src/lib/kosztorys/subcontractor-summary.ts`,
`src/components/kosztorys/summary/blocks/subcontractor-summary.tsx`,
`src/components/kosztorys/summary/blocks/subcontractor-worker-totals.tsx`,
`src/components/kosztorys/summary/blocks/subcontractor-headline-summary.tsx`,
`src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx`, `src/lib/kosztorys/labels.ts`

**Intent**: One query still feeds the block; the premia rows ride in it, typed, and never count as
wypłaty.

**Contract**:

- The query reads `type IN ('PAYOUT','BONUS')` and returns `type` on each row
  (`PayoutTransactionRowT.type: 'PAYOUT' | 'BONUS'`); cache key → `payout-transactions-v2`.
- `derivePayoutsByWorker` sums the two apart: `SubcontractorPayoutRowT` gains `bonus`; `total`
  stays wypłaty only.
- `computeSubcontractorSummary`: row `remaining = due + bonus − paid`, `settlementState` judges on
  `due + bonus` (a worker with only a premia must not read `no_stages`); headline gains
  `bonusTotal` and `remaining = dueNet + bonusTotal − payoutsTotal`; `subcontractorRowTotals` adds
  `bonus`.
- „Podsumowanie pracowników" gains a „Premia" column and the headline a „Premia" row, each only
  when ≠ 0; label `SUBCONTRACTOR_FIGURE_LABELS.bonus = 'Premia'`.
- „Lista wpłat" (`subcontractor-payouts-table`) lists PAYOUT rows only — filter by `type`.
- Both worker drill-down links use `types: ['PAYOUT', 'BONUS']`.

#### 4. „Rozliczenie z ekipą" and the listing

**Files**: `src/components/kosztorys/summary/tabs/margin-actual-table.tsx`,
`src/lib/queries/shape-investments.ts`

**Intent**: The two investment-level „Pozostało" figures add the premia.

**Contract**: both become `due + financials.totalBonus − financials.totalPayouts`; the crew block shows
a „Premia" row when ≠ 0.

### Success Criteria:

#### Automated Verification:

- `worker-payout-pairs` fold/classify unit spec: a pair overpaid by X with a BONUS of X reads `settled`, 0,00
- DB parity spec (`src/__tests__/lib/db/worker-payout-pairs.test.ts`) extended with a BONUS row: Σ pairs still equals the listing's „Pozostało do wypłaty"
- `get-payout-transactions` spec: BONUS rows returned with `type`, cancelled ones excluded
- `subcontractor-summary` spec: row and headline `remaining` include the bonus; a premia-only worker is not `no_stages`; `subcontractorRowTotals` tallies
- `settle-payouts` spec: a pair settled by a premia is `settled`, and its stale-refusal contract still holds

#### Manual Verification:

- Book a 205,01 premia on an overpaid pair (local DB): the Podwykonawcy row, its headline, „Rozliczenie z ekipą", the listing cell, `/pracownicy` and „Rozlicz wypłaty" all read 0,00 for that pair
- „Lista wpłat" does not list the premia; the worker's name link opens a transfer list that does

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: The worker's link and PDF

### Overview

The worker sees their premia as one „Premia" line and a „Pozostało" that counts it.

### Changes Required:

#### 1. Worker summary

**Files**: `src/lib/kosztorys/worker-view/summary.ts`, `src/lib/queries/worker-kosztorys.ts`,
`src/components/kosztorys/summary/blocks/worker-summary.tsx`, `src/lib/kosztorys/print/worker.ts`

**Intent**: Same rows, split by type; the premia is a total, the wypłaty stay itemised.

**Contract**:

- `WorkerSummaryT` gains `bonusNet`; `payouts` / `paidNet` keep PAYOUT rows only;
  `owed = executedNet + bonusNet − paidNet`.
- Link and PDF render „Premia" between „Wykonane razem" and „Wypłacone", only when ≠ 0.
- Cache key `worker-kosztorys-data-v4` → `-v5`.

### Success Criteria:

#### Automated Verification:

- `worker-view/summary` spec: premia excluded from `payouts`/`paidNet`, added to `owed`; an overpaid worker settled by a premia is not `isOverpaid`
- Worker PDF spec (if one exists for `print/worker.ts`) asserts the „Premia" line and its position

#### Manual Verification:

- Roman's worker link and PDF: „Wykonane razem 10 090,80 · Premia 205,01 · Wypłacone 10 295,81 · Pozostało do wypłaty 0,00"
- A worker without a premia sees no „Premia" line

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: „Wyrównaj premią" in the settle dialog

### Overview

One click on an overpaid row of the „Rozlicz wypłaty" dialog books a BONUS for exactly the
overpayment, after a confirm, under the settle-payouts race contract. The Podwykonawcy tab gets a
„Rozlicz wypłaty" button opening that same dialog for its investment, so the premia and the
remaining wypłaty are settled in one place, with one behaviour, from every entry point.

### Changes Required:

#### 1. Action

**File**: `src/lib/actions/book-overpayment-bonus.ts` (+ zod schema beside it or in
`components/forms/…` following `settle-payouts-schema` placement)

**Intent**: Book the premia against the figure the owner saw, never against a moved one.

**Contract**: `bookOverpaymentBonusAction({ investmentId, workerId, expectedRemaining })` via
`protectedAction(…, ['transfers'])`, inside `withPayloadTransaction`:
`lockInvestmentGates` (refuse on lockMessage) → uncached `selectWorkerPayoutPairs` → `classifyPair`;
refuse with `{ stale: true }` + the settle dialog's STALE_MESSAGE when the pair is missing, not
`overpaid`, or its rounded `remaining` ≠ `expectedRemaining`; else `payload.create` a BONUS with
`amount = −remaining`, today's date, `worker`, `investment`, opis „Wyrównanie nadpłaty",
`createdBy`. No sheet sync (`transfersSheetTab: false`). Share STALE_MESSAGE with
`settle-payouts.ts` rather than restating it.

#### 2. Button in the settle dialog

**Files**: `src/components/forms/settle-payouts-form/settle-payouts-table.tsx`,
`src/components/forms/settle-payouts-form/settle-payouts-form.tsx`

**Intent**: Offer the premia on the row that shows the nadpłata, independent of the kasa-bound
„Wypłać" submit — a premia needs no kasa, date or pool.

**Contract**:

- An `overpaid` row that is not ticked shows „Wyrównaj premią" in its „Pozostało do rozliczenia"
  cell (today „—"). Ticking it for a zaliczka hides the button.
- Click → `ConfirmDialog` („Zaksięgować premię {kwota} dla {pracownik} na {inwestycja}? Wyrówna
  nadpłatę; inwestor jej nie widzi.") → the action.
- Success or `stale`: toast, then `reloadRows` (the form already has it for the stale path),
  `setRows`, and re-prefill **keeping the typed values of pairs still present** (keyed by
  investment × worker, not index), so a premia booked mid-dialog does not wipe wypłaty already typed;
  `router.refresh()` so the page under the dialog moves too. The dialog stays open.
- Works from both target kinds without branching — the row carries both ids.

#### 3. Entry point on the Podwykonawcy tab

**Files**: `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx` (or
`subcontractor-worker-totals.tsx`), plus the prop chain from `kosztorys_v2/page.tsx`, which already
holds `investment.name`

**Intent**: The tab that raises the „nadpłacone" alarm opens the same dialog as the listing, instead
of growing its own one-click.

**Contract**: a „Rozlicz wypłaty" button in the „Podsumowanie pracowników" header, rendered when any
row is `payable` or `overpaid`, opening `SettlePayoutsDialog` with
`{ kind: 'investment', id, name }` — exactly what `investment-data-table.tsx` does. No per-row button
on the tab. Gate it to the roles that see the listing's settle action (check how
`investment-data-table` gates `onSettle` and mirror it).

### Success Criteria:

#### Automated Verification:

- Action spec (pattern: `src/__tests__/lib/actions/settle-payouts.test.ts`): books exactly the overpayment as a BONUS with worker + investment and no register; refuses `stale` on a moved figure; refuses a non-overpaid pair; refuses a locked investment; assert the persisted row, not the return value
- `settle-payouts-form` DOM spec: the button renders on an unticked `overpaid` row only; after a successful premia the rows reload and a typed amount on another pair survives
- DOM spec for the Podwykonawcy header button: rendered only when a row is payable or overpaid

#### Manual Verification:

- `/pracownicy` → „Rozlicz wypłaty" → „Wyrównaj premią" on an overpaid row → confirm → the row reads 0,00, the button is gone, the dialog stays open
- Podwykonawcy tab → „Rozlicz wypłaty" opens the same dialog for the investment, with the same button
- With a second tab having booked a wypłata on that pair meanwhile, the click is refused as stale and the figures reload

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Living docs

### Overview

Record BONUS where the next reader looks.

### Changes Required:

- `context/domain/02-glossary.md`: a row for `bonus` / `BONUS` ↔ „Premia".
- `context/foundation/investment-financials-and-discount.md`: marża v2 formula gains `− premia`; why
  v1 does not.
- `AGENTS.md` → Transfer Business Logic: one bullet — BONUS is a non-cash entitlement on an
  investment × worker pair, raises „Pozostało do wypłaty", lowers marża v2 only, never reaches the
  investor or the sheet; an investment-less premia is a PAYOUT.
- `context/foundation/test-plan.md`: extend the „Pozostało" parity risk (#1/#16) to name the premia
  term.

### Success Criteria:

#### Automated Verification:

- None — prose-only phase.

#### Manual Verification:

- The four docs state the same formula and the same investor-invisibility rule

---

## Testing Strategy

Anchored on test-plan risks #1 / #16 (one figure, several homes — parity) plus a new fail-closed
guard: BONUS moves no investor figure.

### Unit Tests:

- Spec table / constants truth tables; validation (worker + investment required, register nulled)
- `deriveFinancials` bucketing; `marginV2` vs `calculateMargin`; `calculateBalance` /
  `computeAmountDue` unchanged by a BONUS row (the investor-invisibility guard)
- `classifyPair`, fold, `computeSubcontractorSummary`, `computeWorkerSummary`

### Integration Tests:

- DB parity: Σ pairs = listing cell with a BONUS row; `get-payout-transactions`; `sum-transfers`;
  the new action against the DB
- Golden master (`financial-golden-master-db.test.ts`): add `totalBonus` to the snapshot; regenerate
  only that field's addition (the dump has no BONUS rows, so every value is 0)

### E2E:

The one-click premia in the settle dialog crosses client → action → DB → revalidation. Author it at the review gate or file
it to the `e2e-backlog` (non-blocking).

### Manual Testing Steps:

1. Local DB, Roman's investment: Podwykonawcy → „Rozlicz wypłaty" → „Wyrównaj premią" 205,01
2. Check the five „Pozostało" surfaces read 0,00 for that pair
3. Check marża v2 dropped by 205,01; marża v1, bilans, kasy unchanged
4. Open `/k/[token]` and the offer PDF: no trace of the premia
5. Worker link + PDF show the „Premia" line

## Migration Notes

Additive enum value. A human applies it to prod (`pnpm db:migrate:prod`) **before** the push that
ships the code. No data backfill: no BONUS rows exist.

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite: `pnpm test` (only when asked — see AGENTS.md)
- DB integration: `pnpm test:integration`; parity: `pnpm test:parity`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-10-02-premia/research.md`
- Booking contract: `src/lib/actions/settle-payouts.ts`
- Enum precedent: `src/migrations/20260611_1_add_loss_enum.ts`
- Non-cash type precedent: `context/archive/2026-08-12-strata-obniza-bilans/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The BONUS type and its financial bucket

#### Automated

- [x] 1.1 Migration applies to the local DB
- [x] 1.2 Spec/constants truth tables updated and green
- [x] 1.3 Validate-hook, transfer-schema and clear-fields-for-type specs cover BONUS
- [x] 1.4 derive-financials-bucketing spec: BONUS → totalBonus only
- [x] 1.5 margin-v2 spec drops by the bonus; v1 unchanged
- [x] 1.6 sum-transfers spec: BONUS moves no kasa

### Phase 2: „Pozostało do wypłaty" counts the premia on all owner surfaces

#### Automated

- [ ] 2.1 worker-payout-pairs fold/classify unit spec
- [ ] 2.2 DB parity spec with a BONUS row
- [ ] 2.3 get-payout-transactions spec
- [ ] 2.4 subcontractor-summary spec
- [ ] 2.5 settle-payouts spec

### Phase 3: The worker's link and PDF

#### Automated

- [ ] 3.1 worker-view/summary spec
- [ ] 3.2 Worker PDF spec

### Phase 4: „Wyrównaj premią" in the settle dialog

#### Automated

- [ ] 4.1 Action spec
- [ ] 4.2 settle-payouts-form DOM spec
- [ ] 4.3 DOM spec for the Podwykonawcy header button

### Phase 5: Living docs

#### Automated

- [ ] 5.1 None — prose-only phase
