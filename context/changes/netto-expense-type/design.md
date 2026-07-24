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

**`amount` is stored as brutto, always. `netAmount` is a second stored figure the user types.**

- The register-balance query (`sumRegisterBalance`, `src/lib/db/sum-transfers.ts:35`) reads the raw
  stored `amount`. It subtracts **brutto**. `netAmount` never touches this query, so the kasa
  reconciles with physical cash to the grosz. This is structurally guaranteed: `sumRegisterBalance`
  has its own standalone `SELECT` and shares no `SUM(amount)` helper with the materiały aggregation
  (verified 2026-07-23).
- The materiały aggregate that feeds the bilans sums **`netAmount`** for net-type rows (and `amount`
  for every normal expense). Two planes, two stored columns — the plane split is a column choice, not
  a computation.

## Data model

A new transfer **type**, sibling to `INVESTMENT_EXPENSE`:

- `INVESTMENT_EXPENSE_NET` — pl label "Wydatek inwestycyjny netto".
  - Chosen at creation, immutable (`access.update: false`), like every other type → drives row color
    and mental model without a mutable "toggle after the fact".
- **Two stored amounts, not a rate** (owner, 2026-07-24). Adding a netto expense, the user types
  **both** figures off the invoice:
  - `amount` — **brutto**, the money that leaves the register (existing field, unchanged semantics).
  - `netAmount` — **netto**, what the investor is billed. A new number field, shown only when
    `type === INVESTMENT_EXPENSE_NET`. **Immutable after create** (`access.update:false`, like `amount`
    and `type`) — a wrong netto is corrected by cancel + re-add, not edited. (Kills the B6 edit path.)
  - **Constraint: `netAmount ≤ amount`** — netto can never exceed brutto, validated **at create**
    (form schema + validate hook). No edit path to re-validate.
  - No VAT rate, no division, no derivation. This is why B5 (list == summary) becomes trivial: netto
    is a stored number, so the list row and the aggregate read the identical value — nothing to round.
- `isExpensesTabType` (`src/lib/constants/transfers.ts`) must include the new type so it counts as
  materiały — but the aggregate sums its **`netAmount`**, not `amount`, see below.

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
- **Net-type** — a single invoice the owner took on himself, billed netto at the exact `netAmount`
  he typed.

They must never compound. Structural rule:

> The global toggle nets **only** brutto expenses. A net-type expense is **carved out** of the
> global toggle's base — its `netAmount` is already netto and can never be netted a second time.

So the server sends materiały in **two buckets** instead of one number:

- `materialsNetTypeNetto` — Σ(net-type `netAmount`), frozen.
- `materialsBruttoBase` — Σ(normal brutto expenses `amount`), the only thing the global toggle may cut.

Client composition:

```
materiały = materialsNetTypeNetto + materialsBruttoBase × (1 − globalRate)
```

The net-type contribution is outside the multiplication, so no double cut is possible — not because
someone remembers, but because the net-type amount is not in the number the global toggle multiplies.

## No formula — netto is stored, not computed

The earlier rate-based design carried a real rounding hazard (Postgres `ROUND` vs JS `Math.round`
drift breaking list == summary). **The stored-`netAmount` model deletes that hazard entirely:**

- Nothing is divided or rounded. `netAmount` is what the user typed off the invoice.
- The list row shows `netAmount`; the aggregate sums `netAmount`. Same stored value → they cannot
  drift. B5 holds by construction.
- The aggregate may therefore stay a plain SQL `SUM(net_amount)` for net-type rows — no per-row TS
  helper needed. (The only care point is the two-bucket split still lives in `deriveFinancials`, so
  the net-type sum goes to `materialsNetTypeNetto`, not the brutto base — see the split section.)

## UI

- **Transaction list** (`src/components/tables/transfers.tsx`): a net-type row shows its **netto**
  (`netAmount`) in a distinct, **not-yet-used** row color (owner: not amber, pick an unused `chart-*`
  token). The type itself is the marker.
- **Create form**: the new type is selectable; when picked, a **netto amount** field appears next to
  the (brutto) `amount` field. Both are typed; validation enforces `netAmount ≤ amount`.

## Blocked / invariant cases — MUST be enforced structurally and covered by tests

These are the regression guards. Each is phrased as a testable assertion.

- **B1 — no double deduction.** A net-type expense, with the global kosztorys toggle ON at −8%: its
  contribution to materiały equals its stored `netAmount` **exactly** — NOT `netAmount × 0.92`. The
  global rate must not touch it.
  _Test: unit on the two-bucket composition — net-type in `materialsNetTypeNetto`, global % applied
  only to `materialsBruttoBase`._

- **B2 — kasa always brutto.** A net-type expense subtracts its full **brutto** `amount` from the
  source register balance. Changing `netAmount` (or the type) does not change any register balance.
  _Test: integration on `sumRegisterBalance` — balance identical whether the expense is
  `INVESTMENT_EXPENSE` or `INVESTMENT_EXPENSE_NET`._

- **B3 — marża unmoved.** Flagging an expense net-type does not change marża
  (`calculate-margin.ts`). _Test: unit — marża identical across the two types for an unsettled
  expense._

- **B4 — no leak into `settled` (marża).** `canBeSettled === isExpensesTabType`, so adding the
  net-type to `EXPENSES_TAB_TYPES` would make it settleable and its amount would flow into
  `totalSettled`, which **marża** reads (`calculate-margin.ts:13`). **Spike decision: net-type is NOT
  settleable** — carve it out of `canBeSettled` so the marża-leak question cannot arise. Its netto
  lands only in the unsettled `totalMaterialCosts` path. _Test: unit — a net-type expense is never
  routed to `totalSettled`; `canBeSettled('INVESTMENT_EXPENSE_NET') === false`._

- **B5 — list == summary.** The netto on the transaction-list row equals the value this expense
  contributes to the bilans. Trivial under the stored-`netAmount` model (same value, no rounding), but
  still guarded. _Test: unit — list row and aggregate read the same `netAmount`._

- **B6 — REMOVED.** `netAmount` is immutable, so there is no edit path to guard. Correcting netto is
  cancel + re-add.

- **B7 — netto ≤ brutto.** `netAmount` cannot exceed `amount` (validated at create). _Test: unit on
  the form schema refine + validate hook — a net-type expense with `netAmount > amount` is rejected._

## Files touched (exhaustive — verified by research 2026-07-24)

**The type union is defined twice and cross-checked at compile time** (`_AllTransferTypesCovered` in
`transfers.ts:34`), and `TRANSFER_TYPE_LABELS` / `TRANSFER_TYPE_COLORS` are `Record<TransferTypeT,…>`
— so forgetting any of the first four lines below **breaks the build** (good guardrail, not a silent
gap).

Type union + field:

- `src/lib/constants/transfers.ts` — add value to `TRANSFER_TYPES` (canonical union);
  `TRANSFER_TYPE_LABELS` "Wydatek inwestycyjny netto"; `TRANSFER_TYPE_COLORS` (row color — a distinct
  **not-yet-used** `chart-*` token, not amber, owner); add to `TRANSACTION_TRANSFER_TYPES` (create-form dropdown) and
  `INVESTMENT_TYPES` (links to investment). **Add to `EXPENSES_TAB_TYPES`** (routing/category/sheet)
  — see decision D.
- `src/lib/constants/transfer-rules.ts` — `canBeSettled` must EXCLUDE the net-type (decision B4);
  review `showsOtherCategory` (line 69) and `needsExpenseCategory` (71-73), which hardcode
  `INVESTMENT_EXPENSE` as string literals — add the net-type so it carries an expense category.
- `src/collections/transfers.ts` — add the Payload option; new `netAmount` number field,
  `access:{update:()=>false}` (immutable, like `amount`), `admin.condition:
(data)=>typeOf(data)==='INVESTMENT_EXPENSE_NET'` — copy the `vatPlane` precedent (lines 120-136). No
  default (the user types it). Validate `netAmount ≤ amount` at create.

Financial math:

- `src/lib/db/investment-financials.ts` — `deriveFinancials`/`deriveCategoryBreakdowns`: branch the
  net-type OUT of the blanket `isExpensesTabType` sum into its own **netto** bucket
  (`materialsNetTypeNetto`), keep `materialsBruttoBase` for the rest; **`totalSettled` untouched**.
  This is the collapse point — the net-type bucket sums `net_amount`, the brutto base sums `amount`.
- `src/lib/db/sum-transfers.ts` — the totals/category queries sum `net_amount` for net-type rows
  (`SUM(net_amount)`) vs `amount` for the rest; **`sumRegisterBalance` unchanged — do not touch**.
- `src/lib/db/calculate-balance.ts` — bilans reads the netto-adjusted materiały aggregate.
- `src/lib/kosztorys/summary-economics.ts` — `materialyPair` (33-42), `computeDoZaplatyRM` (110-124),
  `computeSummarySplit` (85-103): only `materialsBruttoBase` flows through `materialyPair` (the global
  toggle); `materialsNetTypeNetto` is added **post-toggle**, frozen (kills B1 double-deduction).

Editor payload plumbing (widen the shape at every hop):

- `src/lib/queries/client-kosztorys.ts` **and** `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`
  — TWO assembly sites build `KosztorysEditorDataT`; both replace the single `materialsGross` with the
  two buckets.
- `src/lib/kosztorys/types.ts` — `KosztorysEditorDataT` (123-144): add `materialsNetTypeNetto` +
  `materialsBruttoBase`. Prop also threaded through `kosztorys-editor-v2.tsx`, `kosztorys-totals-panel.tsx`,
  `kosztorys-summary.tsx` (all typed `materialsGross: number` today).
- `src/lib/db/map-category-costs.ts` (`buildMaterialyBreakdown`) + `deriveCategoryBreakdowns`
  (`investment-financials.ts`) — stop collapsing the type: emit, per category, a brutto sub-total AND
  a net-type netto sub-total (SQL already groups by `(category, type)` via `sumCategoryByTypeSettled`).
  The breakdown then renders a frozen "…netto" row per category alongside the brutto row (decision C).
  `MaterialyBreakdownRowT` (`src/types/investment-financials.ts:21`) gains a bucket/origin marker.

Create/edit form + persistence:

- `src/components/forms/expense-form/expense-form.tsx` — gate a `netAmount` field on
  `currentType==='INVESTMENT_EXPENSE_NET'` (form already gates fields on `currentType`). Per-line-item
  (the form submits a line-items array; each line = one faktura with its own brutto + netto).
- `src/components/forms/expense-form/expense-schema.ts` — server `createBulkExpenseSchema` auto-accepts
  the type via `z.enum(TRANSFER_TYPES)`; add `netAmount` to the line-item object + a refine
  `netAmount ≤ amount` (B7).
- `src/components/forms/expense-form/map-line-item.ts` + `src/lib/actions/transfers.ts` — thread
  `net_amount` into the persisted doc.
- `src/hooks/transfers/validate.ts` — predicate-driven, follows the set edits; add a rule that
  `netAmount` is present only for the net-type and `≤ amount` (mirror vatPlane).
- `src/components/tables/transfers.tsx` — net-type row shows **netto** (`netAmount`) + color;
  label/color maps auto-apply. Thread `net_amount` through `src/types/transfers.ts` (`TransferRowT`)
  - `src/lib/queries/transfer-mapping.ts` so the list row can render it.

Migrations (hand-written, two):

- Postgres **enum** value: `ALTER TYPE "enum_transactions_type" ADD VALUE 'INVESTMENT_EXPENSE_NET'`
  (precedent `20260212_191046_add_deposit_type.ts`) — **required or Payload writes fail**.
- `net_amount numeric` column (nullable, precedent `20260721_1_add_vat_plane_to_transactions.ts`).
  Register both in `src/migrations/index.ts`. Data is throwaway (kosztorys/spike scope) — no backfill.

Tests to update (will fail on the union change): `src/__tests__/transfer-constants.test.ts` (asserts
exact `TRANSACTION_TRANSFER_TYPES` + predicate tables), plus `validate-hook.test.ts`,
`lib/google/tab-rows.test.ts` if sheet-sync membership changes.

## Out of scope (YAGNI for the spike)

- Audit log for `netAmount` edits (amount edits are logged; netto edits are not — noted gap).
- Touching `vatPlane` (the deposit NET/GROSS field) — unrelated concept, left alone.
- Reworking the global toggle's UX beyond the carve-out.

## Open decisions surfaced by research (need owner sign-off before plan)

_(No open decisions — all resolved below.)_

## Resolved decisions

- **C — net-type faktury are SEPARATE lines in Podsumowanie, split per kategoria** (owner, 2026-07-24).
  The materiały breakdown groups by kategoria wydatku (Płytki, Farby…); a net-type faktura folded into
  its kategoria would be re-cut by the global toggle (Trap B / double-deduction). Instead each kategoria
  that has net-type faktury gets a **second, frozen netto row** for the net-type share (e.g. "Płytki
  netto"), separate from its brutto row. Kategoria (brutto) rows stay pure brutto (toggle cuts them
  cleanly), the netto rows are frozen at `netAmount`. The SQL already groups by `(category, type)`
  (`sumCategoryByTypeSettled`), so `deriveCategoryBreakdowns` just stops collapsing the type — it emits
  a brutto sub-total and a net-type netto sub-total per category. This is the UI face of the two-bucket split.

- **Two stored amounts, not a rate** — owner (2026-07-24): adding a netto expense, the user types both
  `amount` (brutto, leaves kasa) and `netAmount` (netto, bills the investor), constraint
  `netAmount ≤ amount`. Kills the VAT math and the rounding hazard entirely.
- **`netAmount` immutable after create** — owner: both amounts frozen (`access.update:false`). A wrong
  netto is fixed by cancel + re-add, not edited. B6 (edit-path guard) removed.
- **Distinct, not-yet-used row color** — owner: not amber; pick an unused `chart-*` token.
- **`netAmount` is per-line-item** — the expense form submits a line-items array; each faktura carries
  its own brutto + netto.
- **Tests: structural guards now** — B1–B5, B7 as unit tests in this PR (the whole point is "it
  reconciles"). B6 removed; B2 (kasa brutto) covered at the `sumRegisterBalance` layer.
- **B4 — net-type is NOT settleable** (spike) — carved out of `canBeSettled` so netto can never reach
  `totalSettled`/marża. Removes the whole contamination question.
- **D — net-type joins `EXPENSES_TAB_TYPES`** for routing/category/sheet-sync/expenses-tab, but the
  **cost math is carved out** in `deriveFinancials` (own netto bucket). Shared behaviors, separate math.
