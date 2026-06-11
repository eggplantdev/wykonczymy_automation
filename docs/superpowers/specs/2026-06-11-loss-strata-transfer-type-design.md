# Design: `LOSS` ("Strata") transfer type

> Status: approved design, pre-implementation. Date: 2026-06-11.
> Related: `docs/investment-financials-and-discount.md` (the marża/bilans model),
> `docs/notes` lines 97–100 (client request).

## Problem

The client needs a new expense type, **"Strata"** (loss), for a cost the company
absorbs itself. It must:

- **Reduce marża** (it's the owner's loss / cost).
- **Not touch the investor balance** (`bilans`) — it is explicitly _not_ an investor cost.
- **Not move cash** — no source register.
- Be **optionally** linked to an investment (may be attached, may stand alone).

Financial term: a **write-off / loss**. Code value chosen: `LOSS`. Polish UI label: `Strata`.

## Core model change

```
marża  = robocizna − wypłaty − rabat − strata      ← new term
bilans = wpłaty − materiały − robocizna + rabat     ← UNCHANGED
```

`LOSS` is almost a clone of `RABAT` (no source register, P&L-only, reduces marża).
The **one** difference: `RABAT` also raises `bilans` (`calculate-balance.ts` adds
`totalRabat`); `LOSS` must leave `bilans` completely untouched.

## Behavior (confirmed with client)

| Case                           | Where it lands                                                                              | Why it's free                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Attached** to an investment  | Reduces that investment's marża; shows in that investment's transfers table                 | `sumAllInvestmentFinancials` groups by `investment_id`; the per-investment transfers query already filters by investment |
| **Unattached** (no investment) | Reduces only the **global** marża on the Raporty page; appears on no single investment page | `fetchFilteredByType` with no investment filter sums all transactions by type                                            |

Both behaviors fall out of the existing two-view architecture — no new aggregation
plumbing for the "unattached" case.

## Changes

### 1. Type definition — `src/collections/transfers.ts`

Add to `TRANSFER_TYPES`:

```ts
{ label: { en: 'Loss', pl: 'Strata' }, value: 'LOSS' },
```

### 2. Field visibility — `src/collections/transfers.ts`

- `showSourceRegister`: exclude `LOSS` (no cash register) — add `&& data?.type !== 'LOSS'`.
- `showInvestment`: include `LOSS` so the investment field is shown but **not required** (optional link).
- Invoice / `invoiceNote`: no change — stays optional.

### 3. Aggregation — `src/lib/db/sum-transfers.ts`

- `InvestmentFinancialsT`: add `totalLoss: number`.
- `sumAllInvestmentFinancials` SQL: add
  `COALESCE(SUM(CASE WHEN type = 'LOSS' THEN amount ELSE 0 END), 0) AS total_loss`,
  and map `totalLoss: Number(row.total_loss)`.
- `deriveFinancials`: add `totalLoss: totalByType(byType, 'LOSS')`.

### 4. Margin — `src/lib/calculate-margin.ts`

Add a trailing `loss = 0` param:

```ts
export const calculateMargin = (laborCosts, totalPayouts, rabat = 0, loss = 0) =>
  laborCosts - totalPayouts - rabat - loss
```

### 5. Balance — `src/lib/calculate-balance.ts`

**No change.** This is the single line that distinguishes Strata from Rabat.

### 6. Display — `src/components/investments/financial-stats.tsx`

- New optional prop `totalLoss?: number`.
- Render it as its own `StatButton` (mirrors how `Wypłaty` is rendered), with a
  distinct non-`chart-red` color (red is reserved for investor costs / "Koszty inwestora").
- Feed `totalLoss` into `calculateMargin`.
- **Keep it out of `buildFinancialFields`** so it is auto-excluded from the bilans sum
  and from the client-facing export — exactly like `Wypłaty`.
- Visibility: the Strata `StatButton` shows for all page viewers (managers included);
  the marża figure itself stays admin/owner-only as today.

Wire `totalLoss={financials.totalLoss}` at both call sites:

- `src/app/(frontend)/raporty/page.tsx`
- `src/app/(frontend)/inwestycje/[id]/page.tsx`

### 7. Validation — `src/lib/validation-utils.ts`

**No change.** `getAmountError` already rejects `amount <= 0` for any non-`CORRECTION`
type, which forces a positive Strata amount.

### 8. Migration — `src/migrations/`

Hand-written migration adding `LOSS` to the transactions `type` enum. Per AGENTS.md:
do **not** use `pnpm migrate:create` (phantom drift); copy the structure of the latest
migration file and adjust by hand. `pnpm build` runs `payload migrate`.

### 9. Form + constants

- Wire `LOSS` into the transfer entry form so it is selectable.
- Reconcile any duplicate transfer-type list in `src/lib/constants/transfers.ts`
  (AGENTS.md flags this copy as drift-prone; the union source of truth is
  `src/collections/transfers.ts`).

## To verify during planning (not assumed)

- **Sheets sync** — `src/hooks/transfers/sync-sheet.ts`: confirm `LOSS` is a no-op
  (owner-internal, not client-facing). Expected behavior identical to `RABAT`.
- **Display color** — pick a concrete `@theme` token for the Strata stat; not yet chosen.

## Blast radius

- `src/collections/transfers.ts`
- `src/lib/db/sum-transfers.ts`
- `src/lib/calculate-margin.ts`
- `src/components/investments/financial-stats.tsx`
- `src/app/(frontend)/raporty/page.tsx`
- `src/app/(frontend)/inwestycje/[id]/page.tsx`
- `src/lib/constants/transfers.ts` + transfer entry form
- a new file in `src/migrations/`
- tests: `calculate-margin.test.ts`, `sum-transfers.test.ts` (extend for `LOSS`)

`calculate-balance.ts` is deliberately **not** in this list.

## Out of scope

- Request A ("R+M material" / `MATERIAL_INTERNAL`) from
  `docs/investment-financials-and-discount.md` — a different type that _does_ leave a
  cash register. Not part of this change.
