# Netto investment-expense type (spike)

**Branch:** `konradantonik/ex-536-zaliczka-v2` · **Status:** design, spike (throwaway data)
**Register note:** implementation spec — code identifiers are allowed here (per AGENTS.md, code
identifiers live in implementation notes; the owner-facing register stays in the conversation).

## Goal

The owner sometimes takes an investment invoice "na siebie" and reclaims the VAT. For such an
invoice he really pays netto and wants to bill the investor netto too. Cash still leaves the register
at brutto (the invoice is paid gross; the VAT comes back later from the tax office). So one expense
must count **two different amounts on two different planes**:

- **Cash register (kasa):** brutto — the money that actually left.
- **Investor bilans / "do zapłaty":** netto — what the investor owes.

## Core invariant (this is what makes it reconcile)

**`amount` is stored as brutto, always. Netto is never stored — it is derived.**

- The register-balance query (`sumRegisterBalance`, `src/lib/db/sum-transfers.ts:35`) reads the raw
  stored `amount`. It subtracts **brutto**. The word "netto" never touches this query, so the kasa
  reconciles with physical cash to the grosz. This is structurally guaranteed: `sumRegisterBalance`
  has its own standalone `SELECT` and shares no `SUM(amount)` helper with the materiały aggregation
  (verified 2026-07-23).
- Netto exists only as a computed figure `netto = amount ÷ (1 + netRate/100)`, applied **only** in
  the materiały cost aggregate that feeds the bilans.

## Data model

A new transfer **type**, sibling to `INVESTMENT_EXPENSE`:

- `INVESTMENT_EXPENSE_NET` — pl label "Wydatek inwestycyjny netto".
  - Chosen at creation, immutable (`access.update: false`), like every other type → drives row color
    and mental model without a mutable "toggle after the fact".
- New field `netRate` (number, default **23**), shown only when `type === INVESTMENT_EXPENSE_NET`.
  - Editable per expense — an invoice may carry a different VAT (e.g. 8%), so the rate is not a fixed
    constant. Default 23.
- `isExpensesTabType` (`src/lib/constants/transfers.ts`) must include the new type so it counts as
  materiały — but **counted netto**, see below.

## Where the netto lands (and where it must NOT)

`totalMaterialCosts` (`src/lib/db/investment-financials.ts:41`) is the single aggregate both bilanses
read:

- transfers-side "Bilans inwestora" — `calculateBalance` (`src/lib/db/calculate-balance.ts:6`)
- kosztorys "Do zapłaty R+M" — `computeDoZaplatyRM` (`src/lib/kosztorys/summary-economics.ts:110`)

Netting `totalMaterialCosts` for the net-type moves **both** bilanses (owner: "oba"). The aggregate
must expose the split (see next section).

**Must NOT touch:**

- `sumRegisterBalance` (kasa) — stays raw brutto.
- `totalSettled` (`investment-financials.ts:50`) — the settled sibling bucket that **marża** reads
  (`calculate-margin.ts:13`). Netto must land only in the **unsettled** `totalMaterialCosts` path, or
  it silently shifts marża. Marża itself has no materiały term and must not move.

## The two-bucket split (kills the double-deduction)

The global kosztorys toggle ("value ALL materiały netto", `materialsAsNet` / `materialsReduction`)
and this net-type serve **two different business cases**:

- **Global toggle** — the whole investment is settled netto at a negotiated rate (e.g. −8%). Applies
  to normal brutto expenses.
- **Net-type** — a single invoice the owner took on himself, netto at its own VAT (e.g. −23%).

They must never compound. Structural rule:

> The global toggle nets **only** brutto expenses. A net-type expense is **carved out** of the
> global toggle's base — it is already netto and can never be netted a second time.

So the server sends materiały in **two buckets** instead of one number:

- `materialsNetTypeNetto` — Σ(net-type at their own netto), frozen.
- `materialsBruttoBase` — Σ(normal brutto expenses), the only thing the global toggle may cut.

Client composition:

```
materiały = materialsNetTypeNetto + materialsBruttoBase × (1 − globalRate)
```

The net-type contribution is outside the multiplication, so no double cut is possible — not because
someone remembers, but because the net-type amount is not in the number the global toggle multiplies.

## Formula & rounding

- One shared helper computes `netto = round2(amount ÷ (1 + netRate/100))`.
- **Rounded per row to the grosz**, so the netto shown on a transaction-list row equals the value
  summed into the bilans. (Summing raw divisions then rounding once would make the list rows disagree
  with the total.)
- The **same** helper is used by the SQL/server aggregate and the transaction-list display — one
  source of the formula, so list and summary can't drift.

## UI

- **Transaction list** (`src/components/tables/transfers.tsx`): a net-type row shows its **netto**
  amount in a distinct color (amber/orange, tunable). The type itself is the marker.
- **Create form**: the new type is selectable; when picked, the `netRate` field appears (default 23).

## Blocked / invariant cases — MUST be enforced structurally and covered by tests

These are the regression guards. Each is phrased as a testable assertion.

- **B1 — no double deduction.** A net-type expense with `netRate = 23`, with the global kosztorys
  toggle ON at −8%: its contribution to materiały equals `amount ÷ 1.23` **exactly** — NOT
  `(amount ÷ 1.23) × 0.92`. The global rate must not touch it.
  _Test: unit on the two-bucket composition — net-type in `materialsNetTypeNetto`, global % applied
  only to `materialsBruttoBase`._

- **B2 — kasa always brutto.** A net-type expense subtracts its full **brutto** `amount` from the
  source register balance. Changing `netRate` (or the type) does not change any register balance.
  _Test: integration on `sumRegisterBalance` — balance identical whether the expense is
  `INVESTMENT_EXPENSE` or `INVESTMENT_EXPENSE_NET`._

- **B3 — marża unmoved.** Flagging an expense net-type does not change marża
  (`calculate-margin.ts`). _Test: unit — marża identical across the two types for an unsettled
  expense._

- **B4 — no leak into `settled`.** Net-type netto lands only in the unsettled `totalMaterialCosts`
  bucket, never in `totalSettled`. A net-type expense that is `settled` does not apply its netto to
  the marża path. _Test: unit on `deriveFinancials` bucket assignment._

- **B5 — list == summary.** The netto shown on the transaction-list row equals, to the grosz, the
  value this expense contributes to the bilans (shared helper, per-row rounding).
  _Test: unit asserting the row formatter and the aggregate use the same helper on the same input._

- **B6 — bilans moves, kasa doesn't, on rate edit.** Editing `netRate` changes both bilanses and the
  list row, and leaves every register balance untouched. _Test: integration._

## Files touched

- `src/collections/transfers.ts` — new type in `TRANSFER_TYPES`; `netRate` field with type condition.
- `src/lib/constants/transfers.ts` — `isExpensesTabType` includes the new type; type→color map.
- `src/lib/db/investment-financials.ts` — split `totalMaterialCosts` into net-type-netto + brutto
  buckets; keep `totalSettled` untouched.
- `src/lib/db/sum-transfers.ts` — the materiały aggregation returns the split; `sumRegisterBalance`
  unchanged.
- `src/lib/db/calculate-balance.ts` — bilans reads the netto-adjusted materiały.
- `src/lib/kosztorys/summary-economics.ts` — `computeDoZaplatyRM` + the global-toggle composition
  consume the two buckets.
- `src/lib/queries/client-kosztorys.ts` / `src/lib/kosztorys/types.ts` — carry the two buckets to the
  editor.
- `src/components/tables/transfers.tsx` — net-type row: netto + color.
- transfer create form — type option + `netRate` field.
- New shared netto helper (formula + per-row rounding) — one home, used by SQL layer and the list.
- Migration (hand-written): add `net_rate` column to `transactions`. New type is an enum value in
  the app union, no schema change beyond the column.

## Migration

Data is throwaway (kosztorys/spike scope) — no backfill. Add `net_rate numeric` (nullable, default
23 applied at write, not DB default) to `transactions`. Hand-written per repo convention.

## Out of scope (YAGNI for the spike)

- Audit log for `netRate` edits (amount edits are logged; netto edits are not — noted gap).
- Touching `vatPlane` (the deposit NET/GROSS field) — unrelated concept, left alone.
- Reworking the global toggle's UX beyond the carve-out.

## Open decision

- **netRate: editable per expense, default 23** — chosen here (an invoice may carry a non-23 VAT).
  If the owner wants a fixed 23% instead, drop the field and use a constant. Flag before implementing.
