# Settled corrections + investment-financials parity (single source of truth)

Date: 2026-06-19
Status: design — awaiting user review

## Problem

The same per-investment figures (bilans, marża, materiały, wydatki inwestycyjne,
wypłaty) are shown in two places and computed by **two different code paths**:

- **Listing** (`/inwestycje`) — one bulk SQL query for all investments at once:
  `sumAllInvestmentFinancials()` in `src/lib/db/sum-transfers.ts`
  (`GROUP BY investment_id`).
- **Detail** (`/inwestycje/[id]`) — per-investment, filterable path:
  `sumFilteredByType()` + `sumCategoryBreakdown()` + `sumSettledCategoryBreakdown()`
  → `deriveFinancials()`.

Both paths converge on the **same** display-layer functions
(`calculateBalance`, `calculateMargin`, category sums), so the _formulas_ never
diverge. The divergence lives one layer down: **which rows each SQL query puts into
each bucket** (materiały vs settled vs income …).

### The concrete divergence: a settled CORRECTION

A `settled = true` row means a material expense is "wliczone w robociznę" — it leaves
the register, is **not** billed to the client (off bilans), and **lowers marża**.

For `CORRECTION` rows the two paths disagree:

- **Listing** `total_costs`: `type IN ('INVESTMENT_EXPENSE','CORRECTION') AND settled IS NOT TRUE`
  → a settled CORRECTION is **excluded** from materiały.
- **Detail** `deriveFinancials`: `totalMaterialCosts = INVESTMENT_EXPENSE + CORRECTION`,
  where only `INVESTMENT_EXPENSE` is re-bucketed out when settled
  (`sumFilteredByType` maps settled `INVESTMENT_EXPENSE` → `INVESTMENT_EXPENSE_SETTLED`).
  A settled CORRECTION is **kept** in materiały.

Today this is **latent**, not active: the create action coerces `settled = false` for
any non-`INVESTMENT_EXPENSE` type (`src/lib/actions/transfers.ts:142`), the form hides
the checkbox for `CORRECTION`, and the edit form never touches `settled`. So no
settled CORRECTION should exist in current data — but the Payload admin panel has no
hard guard, so this must be verified against real data, not assumed.

### The business gap behind it

A `CORRECTION` is a **freestanding, investment-level** adjustment to material costs
(amount may be negative; the only back-link in the schema is `cancelledTransaction`,
gated to `CANCELLATION`). When you need to correct material that was **settled** (folded
into robocizna), today there is **no correct representation**:

- A normal (non-settled) CORRECTION hits bilans — wrong, the client was never billed.
- A settled CORRECTION would correctly stay off bilans, but the margin bucket
  (`total_settled` = `type = 'INVESTMENT_EXPENSE' AND settled`) ignores CORRECTION
  entirely, so margin would not move — the credit vanishes.

**Target semantics (confirmed):** a settled CORRECTION mirrors a settled
`INVESTMENT_EXPENSE` — off bilans, into `totalSettled` → moves marża. A `−200` credit
on settled material ⇒ bilans unchanged, marża +200.

## Decisions (locked)

1. **Mechanism:** reuse the existing "Wliczone w robociznę" checkbox; show it for
   `CORRECTION` too. No link to an original transaction (user owns the judgment).
2. **Semantics:** settled applies symmetrically to `INVESTMENT_EXPENSE` and
   `CORRECTION`. Implementing this correctly _is_ the fix for the listing/detail
   divergence.
3. **Refactor variant: 2c — "dumb SQL + one JS classifier"** (single source of truth).
4. **Baseline first:** before any production-code change, capture current figures for
   every investment via both paths into a file, to find current outliers and to serve
   as a before/after regression baseline.
5. **File format:** JSON (exact machine diff) **and** CSV (human/spreadsheet) from the
   same run.

## Architecture (variant 2c)

Move the bucketing rule — "(type, settled) → which bucket" — into **one** place (JS).
SQL only sums raw amounts.

- Both queries return **raw** sums grouped by `(investment_id, type, settled,
expense_category_id)`. SQL no longer encodes business rules (drop the inline
  `total_costs` / `total_settled` CASE soup and the `sumFilteredByType` settled
  re-bucket CASE).
- `deriveFinancials` is extended to receive `settled` and perform **all** bucketing in
  JS, including the settled re-bucket currently done in SQL.
- **Listing** groups the raw rows by `investment_id` and calls `deriveFinancials` per
  investment. **Detail** calls `deriveFinancials` for its single investment.
- Same function, same inputs → same output, **by construction**.

Not a performance regression: the listing still runs ~1 query; finer grouping yields a
few thousand rows for ~200 investments, grouped in JS — trivial.

### Bucketing rule after change (symmetric)

- `INVESTMENT_EXPENSE` or `CORRECTION` with `settled = true` → out of materiały/bilans,
  into `totalSettled` (and `settledCategoryCosts` by category) → lowers marża.
- `settled = false` → unchanged from today.
- bilans formula (`calculate-balance.ts`) and marża formula (`calculate-margin.ts`)
  are **unchanged** — only their inputs change.

## Surface changes (form / action / collection)

- `src/components/forms/expense-form/expense-form.tsx`: show the `settled` checkbox for
  `CORRECTION` as well as `INVESTMENT_EXPENSE`.
- `src/lib/actions/transfers.ts` (~`:142`): allow `settled` to persist for
  `type IN ('INVESTMENT_EXPENSE','CORRECTION')`.
- `src/collections/transfers.ts` (~`:237`): widen the `admin.condition` for the
  `settled` field to include `CORRECTION`.
- **Guard** in `src/hooks/transfers/validate.ts`: force `settled = false` for any type
  other than `INVESTMENT_EXPENSE` / `CORRECTION`, so the admin panel cannot persist a
  stray settled flag on an unrelated type.

## Baseline / snapshot tool (Phase 0)

Read-only script against the **local Docker** Postgres (never Neon). For every
investment, compute all six figures via **both** the listing path and the detail path,
and emit:

- `*.json` — exact values for machine diff (before/after).
- `*.csv` — same data, human-readable, with a `match?` column (listing == detail) so
  current outliers are visible at a glance.

Columns per investment (`id`, `name`):

| figure          | listing source            | detail source            |
| --------------- | ------------------------- | ------------------------ |
| bilans          | `calculateBalance` (bulk) | `calculateBalance` (per) |
| marża           | `calculateMargin` (bulk)  | `calculateMargin` (per)  |
| materiały       | `totalMaterialCosts`      | `totalMaterialCosts`     |
| wydatki inwest. | sum of `categoryCosts`    | sum of `categoryCosts`   |
| wypłaty         | `totalPayouts`            | `totalPayouts`           |
| settled         | `totalSettled`            | `totalSettled`           |

Roundness: figures rounded consistently (e.g. 2 dp) before comparison so float
formatting does not create false diffs.

## Testing

- **Unit parity test** (permanent CI guard): synthetic transaction sets fed through
  **both** paths (both ultimately `deriveFinancials`); assert all six figures equal.
  Includes a settled-CORRECTION scenario asserting the target semantics (off bilans,
  into marża). Style mirrors `src/__tests__/sum-transfers.test.ts` (mocked
  `db.execute`).
- **Before/after diff** from Phase 0 re-run as evidence of no unintended regression.

## Phase plan

0. Build snapshot tool; run on local DB → "before" file; report current outliers.
1. Implement the change (architecture 2c + surface changes + guard).
2. Re-run snapshot → "after" file; diff before/after. Expect empty diff except
   intentional settled-CORRECTION cases (none in existing data unless Phase 0 finds a
   stray row).
3. Add the unit parity test to CI.

## Risks / notes

- 2c rewrites the listing's hot bulk query. Mitigated by the Phase 0 baseline + the
  parity test.
- If Phase 0 finds an existing settled CORRECTION, that investment's bilans/marża will
  shift to the corrected values after Phase 1 — surface it explicitly, do not silently
  change it.
- Migrations are hand-written in this repo; no schema change is needed (the `settled`
  column already exists), so no migration is expected.
- Local DB is a refreshable copy of prod; confirm before any reset. The tool is
  read-only.
