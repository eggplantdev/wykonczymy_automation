# Investment Rabat — design

Date: 2026-06-11
Status: approved for planning

## Goal

Add a **rabat** (discount on the labour price) to an investment. A rabat is the company's
cost: it reduces what the client owes (bilans inwestora) **and** reduces company profit
(marża). This is the dual effect that distinguishes it from a `CORRECTION` (korekta), which
only moves the balance.

Background and the economic model: `docs/investment-financials-and-discount.md` (Request B).

## Confirmed decisions

1. **Effect** — reduces both marża and the client balance.
2. **Entry point** — added to the existing transfer/expense dialog (no dedicated UI).
3. **Sheets sync** — none; the kosztorys export is untouched (a rabat is a billing figure,
   like robocizna, not a material line).
4. **Display row** — a distinct "Rabat" line grouped with the **green** row (Wpłaty), because
   it adds to the balance (`+rabat`). Kept visible as its own figure, not netted into Robocizna.
5. **Process** — full spec → plan → implementation.

## Data model

New transfer type `RABAT`:

- Defined in both `src/collections/transfers.ts` (`TRANSFER_TYPES` with PL/EN labels) and
  `src/lib/constants/transfers.ts` (`TRANSFER_TYPES` string union + label/color maps).
- **Requires** an investment.
- **No** source register and **no** expense category — mirrors `LABOR_COST` (it never moves
  cash between registers).
- `paymentMethod` remains (defaults `CASH`) only to satisfy the collection's required field;
  it has no cash meaning for a rabat.
- `amount` is the positive discount value in złoty.
- Polish label: `Rabat`.

A hand-written Payload migration adds `'RABAT'` to the Postgres enum backing
`transactions.type`. Per AGENTS.md: copy the latest file in `src/migrations/`, do not trust
`migrate:create`.

## The funnel: `deriveFinancials` (`src/lib/db/sum-transfers.ts`)

`InvestmentFinancialsT` gains `totalRabat: number`.

- `deriveFinancials` adds `totalRabat = Σ RABAT` (via `totalByType`).
- `sumAllInvestmentFinancials` SQL gains a `total_rabat` CASE sum, mapped into the result.

This is the single point that feeds the balance, the margin, the investment table, and the
reports page. Everything downstream reads `financials.totalRabat`.

## Formulas

- **`calculate-balance.ts`**: `income − materials − labor + rabat`.
  The rabat lowers what the client owes, so it adds to the balance. One-line change reading
  `financials.totalRabat`.
- **`calculate-margin.ts`**: signature gains a `rabat` parameter →
  `labor − payouts − rabat`. The company earns less by the discount.
  - Callers updated: `src/components/investments/financial-stats.tsx`,
    `src/lib/queries/investments.ts`.

No cap is enforced: a rabat may exceed robocizna and drive margin negative. That is allowed.

## Display

- `buildFinancialFields` (`src/lib/map-category-costs.ts`) emits a `Rabat` field when
  `totalRabat !== 0`, with a **positive** amount (`+totalRabat`) so the dynamic
  _Bilans inwestora_ sum picks it up as a balance-increasing line.
- `financial-stats.tsx` groups the `Rabat` label into the **green** `incomeRow` (extend the
  income/correction filter to include the rabat label).
- Admin _Marża_ is recomputed through the extended `calculateMargin`.

## Entry point

- `RABAT` added to `TRANSACTION_TRANSFER_TYPES` so it appears in the existing expense/transfer
  dialog (`src/components/forms/expense-form/expense-form.tsx`) alongside Korekta, Robocizna,
  etc.
- Predicate helpers in `constants/transfers.ts` updated:
  - `requiresInvestment` → include `RABAT`.
  - `needsSourceRegister` → exclude `RABAT` (like `LABOR_COST`).
  - `showsInvestment` / `INVESTMENT_TYPES` → include `RABAT`.
- `src/collections/transfers.ts` conditions mirrored: `showSourceRegister` excludes `RABAT`,
  `showInvestment` includes it.
- Verify the form's Zod schema (`expense-schema.ts`) accepts the new type (it derives from the
  type list) and that `createBulkTransferAction` handles it generically (it routes by type
  through Payload create — no per-type branch expected).

## Validation

No special rule. The default branch of `getAmountError` (`src/lib/validation-utils.ts`)
already rejects `amount <= 0`, so "positive only" is enforced for free.

## Tests

- `src/__tests__/sum-transfers.test.ts` — `deriveFinancials` `toEqual` assertions gain
  `totalRabat`; add a case summing `RABAT` rows.
- New/extended cases for `calculate-balance` (`+rabat`) and `calculate-margin` (`−rabat`).

## Blast radius (files touched)

- `src/collections/transfers.ts` — type + field conditions
- `src/lib/constants/transfers.ts` — union, labels, colors, predicates, dialog list
- `src/lib/db/sum-transfers.ts` — `InvestmentFinancialsT`, `deriveFinancials`, SQL CASE
- `src/lib/calculate-balance.ts` — `+ rabat`
- `src/lib/calculate-margin.ts` — `− rabat` (signature change)
- `src/components/investments/financial-stats.tsx` — pass/compute rabat, green grouping
- `src/lib/map-category-costs.ts` — Rabat field row
- `src/lib/queries/investments.ts` — margin caller, fallback financials object
- `src/lib/tables/investments.tsx` — only if the row type needs `totalRabat` (likely not)
- `src/migrations/<new>.ts` — enum value `RABAT`
- `src/__tests__/sum-transfers.test.ts` (+ balance/margin tests)

## Out of scope

- Request A (R+M internal materials / `MATERIAL_INTERNAL`) — separate feature.
- Any change to the Google Sheets / kosztorys export.
- Capping or warning when a rabat exceeds robocizna.
