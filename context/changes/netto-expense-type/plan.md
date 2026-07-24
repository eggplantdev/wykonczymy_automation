# Netto investment-expense type — Implementation Plan

## Overview

Add a new transfer type `INVESTMENT_EXPENSE_NET` (sibling to `INVESTMENT_EXPENSE`) that carries a
**second stored amount** `netAmount`. The expense leaves the cash register at **brutto** (`amount`,
the physical cash fact) but is billed to the investor at **netto** (`netAmount`). This lets the owner
book an invoice he took "na siebie" (VAT reclaimed) at the netto he actually pays, while the kasa
still reconciles to the grosz.

Full spec + rationale: `context/changes/netto-expense-type/design.md`.

## Current State Analysis

Verified by two research sweeps (2026-07-23/24), captured in `design.md`:

- **Kasa is structurally isolated.** `sumRegisterBalance` (`src/lib/db/sum-transfers.ts:35-64`) has
  its own `SELECT`, subtracts any non-`DEPOSIT_TYPES` row as an outflow, and shares no `SUM(amount)`
  helper with materiały. Keeping the net-type out of `DEPOSIT_TYPES` makes it an outflow at brutto
  with zero changes to that query.
- **The type union is defined twice** (`src/lib/constants/transfers.ts:2-16` canonical, plus the
  Payload options in `src/collections/transfers.ts:16-32`) and cross-checked at compile time
  (`_AllTransferTypesCovered`). `TRANSFER_TYPE_LABELS` / `TRANSFER_TYPE_COLORS` are
  `Record<TransferTypeT,…>` → a missing key **breaks the build**.
- **SQL grouping is granular** — `sumAllInvestmentFinancials` groups by `(investment_id, type, settled)`
  and `sumCategoryByTypeSettled` by `(category, type, settled)`, so a new type surfaces as its own row.
  The **collapse** happens one layer up in `deriveFinancials` / `deriveCategoryBreakdowns`
  (`src/lib/db/investment-financials.ts:16-53`), where `isExpensesTabType` folds every expense type
  into the single scalar `totalMaterialCosts`.
- **Both bilanses read `totalMaterialCosts`** — transfers-side `calculateBalance`
  (`src/lib/db/calculate-balance.ts:6`) and kosztorys-side `computeDoZaplatyRM`
  (`src/lib/kosztorys/summary-economics.ts:110`). Netting the net-type moves both (owner: "oba").
- **Marża does not read materiały** (`calculate-margin.ts:13`, `totalLaborCosts − payouts − rabat −
loss − totalSettled`), but `totalSettled` is a sibling bucket marża **does** read.
- **The global kosztorys toggle** (`materialsAsNet` / `materialsReduction`) is applied in one place,
  `materialyPair` (`summary-economics.ts:33-42`), consumed by `computeDoZaplatyRM` and
  `computeSummarySplit`.
- **The editor payload** collapses materiały to a single `materialsGross: number`
  (`KosztorysEditorDataT`, `src/lib/kosztorys/types.ts:123-144`), assembled at TWO sites:
  `src/lib/queries/client-kosztorys.ts:56` and `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:84`.
- **The create form** (`src/components/forms/expense-form/expense-form.tsx`) submits a line-items
  array and already gates fields on `currentType`; `vatPlane` (`transfers.ts:120-136`) is the
  precedent for a conditional immutable field.

## Desired End State

The owner can add an expense as "Wydatek inwestycyjny netto", typing both a brutto and a netto amount
(netto ≤ brutto). The register drops by brutto; the investor's bilans / "Do zapłaty R+M" rises by
netto. In the kosztorys Podsumowanie the net-type share shows as its own frozen netto row per
kategoria, immune to the global "wszystko netto" toggle (no double cut). The transaction list shows
the netto amount in a distinct color. Marża is unchanged. Every register balance is unchanged.
Guards B1–B5 + B7 pass as unit tests.

Verify: unit suite green; manually, adding a net-type expense drops the register by brutto and raises
"Do zapłaty" by netto, and turning the global toggle on does not cut the net-type row further.

### Key Discoveries

- Kasa isolation is structural, not incidental — `sum-transfers.ts:35-64`. Do NOT touch it.
- The collapse to fix is `deriveFinancials`/`deriveCategoryBreakdowns`, not the SQL — `investment-financials.ts:16-53`.
- One toggle application point to split — `materialyPair`, `summary-economics.ts:33-42`.
- Two editor-payload assembly sites must stay in lockstep — `client-kosztorys.ts:56` + `kosztorys_v2/page.tsx:84`.
- `netAmount` is stored, not derived → no VAT math, no rounding, B5 holds by construction.

## What We're NOT Doing

- **No `netRate` / VAT computation** — netto is typed, not derived. No shared rounding helper.
- **No edit path for `netAmount`** — immutable after create; correction is cancel + re-add. B6 removed.
- **Not touching `sumRegisterBalance`** or `DEPOSIT_TYPES` — kasa stays brutto.
- **Not touching `vatPlane`** (the deposit NET/GROSS field) — unrelated concept.
- **Net-type is not settleable** — carved out of `canBeSettled`, so it can never reach `totalSettled`/marża.
- **No data backfill** — kosztorys/spike data is throwaway (AGENTS.md).
- **No audit log** for the netto figure (amount edits are logged; this is a noted gap, out of scope).
- **No B6 integration test** and no E2E in this PR — structural units only.

## Implementation Approach

Bottom-up in dependency order: (1) the type + DB schema so writes are legal, (2) the financial
derivation split so both bilanses see netto while kasa/marża don't, (3) thread the two buckets to the
editor and rewrite the toggle composition so the net-type is frozen, (4) the create form + list UI.
Each phase typechecks on its own and lands its guards.

The spine is the **two-bucket split**: `deriveFinancials` classifies `INVESTMENT_EXPENSE_NET` rows
into `materialsNetTypeNetto` (Σ `netAmount`, frozen) instead of the brutto `totalMaterialCosts`/base.
Downstream, only the brutto base flows through the global toggle; the net-type bucket is added after,
untouched. This makes double-deduction structurally impossible — the net-type amount is simply not in
the number the toggle multiplies.

## Critical Implementation Details

**Timing & ordering.** The Postgres **enum** migration (`ADD VALUE`) must be applied before any code
path writes the new type, and Postgres cannot add an enum value and use it in the same transaction —
keep the enum `ADD VALUE` in its own migration, separate from anything that references it. Apply both
migrations to the local dev DB before running the app; prod migration is a human, deploy-time step
(AGENTS.md `payload-prod-migrate`) and is NOT part of this local task.

**State sequencing (the split must survive both planes).** `deriveCategoryBreakdowns` and
`deriveFinancials` must classify the net-type consistently: its `netAmount` goes to the netto bucket
in BOTH the scalar totals and the per-category breakdown, and its brutto `amount` appears in NEITHER
the brutto base nor `totalSettled`. A net-type row contributing `amount` to the brutto base anywhere
reintroduces the double-cut.

## Phase 1: Type + schema foundation

### Overview

Make `INVESTMENT_EXPENSE_NET` a legal, well-classified transfer type with an immutable `netAmount`
field and the DB columns to store it. No financial-math change yet — this phase only lands the type,
the field, the predicate-set memberships, and the migrations.

### Changes Required

#### 1. Type union + labels + color

**File**: `src/lib/constants/transfers.ts`

**Intent**: Register the new type everywhere the union fans out so the build's `Record` guards are
satisfied and the type is routed correctly.

**Contract**: Add `'INVESTMENT_EXPENSE_NET'` to `TRANSFER_TYPES`; add `TRANSFER_TYPE_LABELS` entry
"Wydatek inwestycyjny netto"; add `TRANSFER_TYPE_COLORS` entry — a **not-yet-used** `chart-*` token
(grep the existing map + `@theme` tokens to pick one no other type uses, not amber). Add to
`TRANSACTION_TRANSFER_TYPES` (create-form dropdown), `INVESTMENT_TYPES` (links to an investment), and
`EXPENSES_TAB_TYPES` (routing/category/sheet-sync). Do **not** add to `DEPOSIT_TYPES`.

#### 2. Predicate carve-outs

**File**: `src/lib/constants/transfer-rules.ts`

**Intent**: The net-type behaves like a material expense for routing/category, but must NOT be
settleable (keeps netto out of marża).

**Contract**: `canBeSettled` must return `false` for `INVESTMENT_EXPENSE_NET` (it currently aliases
`isExpensesTabType`, which will now include the net-type — so add an explicit exclusion). Review the
string-literal predicates `showsOtherCategory` (line 69) and `needsExpenseCategory` (71-73): add the
net-type to `needsExpenseCategory` so it carries an expense category.

#### 3. Payload collection: option + `netAmount` field

**File**: `src/collections/transfers.ts`

**Intent**: Add the selectable type and its immutable netto companion field, shown only for the net-type.

**Contract**: Add the Payload `{label:{en,pl}, value:'INVESTMENT_EXPENSE_NET'}` option (satisfies
`_AllTransferTypesCovered`). New `netAmount` number field: `access:{update:()=>false}`,
`admin.condition:(data)=>typeOf(data)==='INVESTMENT_EXPENSE_NET'` (copy the `vatPlane` shape, lines
120-136), no `defaultValue`. Add a field/collection validate that `netAmount != null` and
`netAmount <= amount` when the type is net (create-time; the field is immutable so no re-validate).

#### 4. Migrations (two, hand-written)

**File**: `src/migrations/<ts>_add_investment_expense_net_type.ts` and
`src/migrations/<ts>_add_net_amount_to_transactions.ts`

**Intent**: Make the enum value and the column exist in Postgres.

**Contract**: Migration A: `ALTER TYPE "public"."enum_transactions_type" ADD VALUE
'INVESTMENT_EXPENSE_NET'` (precedent `20260212_191046_add_deposit_type.ts`). Migration B:
`ADD COLUMN IF NOT EXISTS "net_amount" numeric` on `transactions` (precedent
`20260721_1_add_vat_plane_to_transactions.ts`). Register both in `src/migrations/index.ts`, enum
migration ordered first. Apply to local dev DB only.

#### 5. Update constants test

**File**: `src/__tests__/transfer-constants.test.ts`

**Intent**: The test asserts the exact contents of `TRANSACTION_TRANSFER_TYPES` and predicate tables;
update expectations for the new type (incl. `canBeSettled` false, `isExpensesTabType` true).

**Contract**: Add the net-type to the asserted membership/predicate rows.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm tsc --noEmit`
- Constants test passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- Both migrations apply cleanly to local dev DB: `pnpm payload migrate` (against local `DB_POSTGRES_URL`)

#### Manual Verification:

- In the Payload admin, creating a transaction with type "Wydatek inwestycyjny netto" shows the
  `netAmount` field; other types do not.
- `netAmount > amount` is rejected on save.

---

## Phase 2: Financial split (two buckets, kasa/marża untouched)

### Overview

Split the materiały aggregate so the net-type's `netAmount` lands in its own frozen netto bucket
(scalar + per-category), the brutto base holds everything else, `totalSettled` and `sumRegisterBalance`
are untouched. This is the correctness core.

### Changes Required

#### 1. Derive two buckets + per-category split

**File**: `src/lib/db/investment-financials.ts`

**Intent**: Stop the `isExpensesTabType` collapse from merging the net-type into brutto; emit a
separate frozen netto bucket, in both the scalar totals and the per-category breakdown.

**Contract**: `deriveFinancials` returns new fields `materialsNetTypeNetto` (Σ `netAmount` of
unsettled net-type rows) and `materialsBruttoBase` (the existing brutto material sum, now excluding
net-type). Keep `totalMaterialCosts` = base + netTypeNetto for any consumer that still wants the
combined figure, OR replace it — decide by consumer audit (both bilanses will consume the split; the
combined stays as a convenience total). `totalSettled` unchanged (net-type never settled).
`deriveCategoryBreakdowns` keeps `type` and emits, per category, a brutto sub-total and a net-type
netto sub-total. `InvestmentFinancialsT` (`src/types/investment-financials.ts`) widens accordingly;
`MaterialyBreakdownRowT` gains an origin/bucket marker.

#### 2. Carry `net_amount` through the aggregation

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: The totals/category queries must expose `net_amount` for net-type rows so `deriveFinancials`
can sum netto. `sumRegisterBalance` stays exactly as is.

**Contract**: `sumAllInvestmentFinancials` / `sumCategoryByTypeSettled` select `SUM(net_amount)` (or
carry it per grouped row) alongside `SUM(amount)`. `sumRegisterBalance` / `sumAllRegisterBalances`:
**no change** (asserted by B2).

#### 3. Bilans consumers read the split

**File**: `src/lib/db/calculate-balance.ts`

**Intent**: The transfers-side bilans must count the net-type at netto, brutto expenses at brutto.

**Contract**: `calculateBalance` reads `materialsBruttoBase + materialsNetTypeNetto` where it used
`totalMaterialCosts`. (Marża file untouched — asserted by B3.)

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B2 (kasa brutto): unit asserts `INVESTMENT_EXPENSE_NET ∉ DEPOSIT_TYPES` and the register CASE treats
  it as an outflow at `amount` — `pnpm exec vitest run` on the new spec.
- B3 (marża unmoved): unit — marża identical whether an unsettled expense is `INVESTMENT_EXPENSE` or
  `INVESTMENT_EXPENSE_NET`.
- B4 (no settled leak): unit — a net-type row is never routed to `totalSettled`; `canBeSettled` is false.
- Bucket assignment unit — a net-type row lands in `materialsNetTypeNetto` (its `netAmount`), never in
  `materialsBruttoBase`.

#### Manual Verification:

- Bilans inwestora on an investment with a net-type expense reflects netto, not brutto.
- Register balance on that investment's source register is unchanged by the net-type's presence.

---

## Phase 3: Editor threading + toggle composition

### Overview

Carry the two buckets to the kosztorys editor and rewrite the summary composition so only the brutto
base flows through the global toggle; the net-type bucket is added post-toggle, frozen. Render the
per-category netto rows in Podsumowanie.

### Changes Required

#### 1. Widen the editor payload

**File**: `src/lib/kosztorys/types.ts`, `src/lib/queries/client-kosztorys.ts`,
`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Replace the single `materialsGross` with the two buckets, at both assembly sites, in lockstep.

**Contract**: `KosztorysEditorDataT` gains `materialsNetTypeNetto: number` + `materialsBruttoBase:
number` (keep `materialsGross` only if a consumer needs the combined). Both assembly sites populate
them from `deriveFinancials`. The `materialyBreakdown` carries the per-category netto rows.

#### 2. Split the toggle composition

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: The global toggle must cut only the brutto base; the net-type netto is added afterwards,
untouched — the structural kill for double-deduction.

**Contract**: `computeDoZaplatyRM` (110-124) and `computeSummarySplit` (85-103): pass
`materialsBruttoBase` through `materialyPair` (the toggle), then add `materialsNetTypeNetto` to the
`.net` result **outside** `materialyPair`. `materialyPair` itself is unchanged; the callers change what
they feed it and add the frozen bucket post-hoc.

#### 3. Render per-category netto rows

**File**: `src/components/kosztorys/summary-breakdown-table.tsx` (+ the breakdown row type)

**Intent**: Show each category's net-type share as its own frozen "…netto" row, so the brutto rows the
toggle affects stay pure.

**Contract**: The breakdown maps net-type netto sub-totals to their own rows (label "<kategoria>
netto"), rendered at their stored `netAmount` regardless of the toggle. Brutto category rows keep the
existing toggle-driven valuation.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B1 (no double deduction): unit on the composition — with the global toggle at −8%, the net-type's
  contribution equals its `netAmount` exactly, not `netAmount × 0.92`.
- B5 (list == summary): unit — the value a net-type row contributes to the aggregate equals its stored
  `netAmount` (same value, no rounding).
- Existing kosztorys summary/economics unit tests still pass: `pnpm exec vitest run src/__tests__` (economics specs).

#### Manual Verification:

- In Podsumowanie, a net-type expense shows as its own netto row under its kategoria.
- Toggling "wszystko netto −X%" does not change the net-type row; it changes only the brutto rows.
- "Do zapłaty R+M" matches the bilans inwestora for the same investment.

---

## Phase 4: Create form + transaction list

### Overview

Let the user pick the type and type both amounts (netto ≤ brutto), persist `net_amount`, and show the
net-type row in the transaction list at netto in its color.

### Changes Required

#### 1. Form field + schema + persistence

**File**: `src/components/forms/expense-form/expense-form.tsx`,
`src/components/forms/expense-form/expense-schema.ts`,
`src/components/forms/expense-form/map-line-item.ts`, `src/lib/actions/transfers.ts`

**Intent**: A per-line netto field appears when the line's type is the net-type; the amount is
validated ≤ brutto and threaded to the DB write.

**Contract**: Gate a `netAmount` input on `currentType==='INVESTMENT_EXPENSE_NET'` (the form already
gates fields on `currentType`); add `netAmount` to the line-item client + server schemas with a refine
`netAmount <= amount` (B7). `map-line-item.ts` + the bulk transfer action thread `net_amount` into the
persisted doc. Add the net-type + `netAmount≤amount` rule to `src/hooks/transfers/validate.ts`
(predicate-driven, mirrors the vatPlane guard).

#### 2. List row: netto + color

**File**: `src/components/tables/transfers.tsx`, `src/types/transfers.ts`,
`src/lib/queries/transfer-mapping.ts`

**Intent**: The net-type row shows its netto amount in the new color; the label/color maps already
apply via Phase 1.

**Contract**: Thread `net_amount` through `TransferRowT` + `mapTransferRow`; the amount cell renders
`netAmount` for the net-type (brutto still what left the kasa, but the list shows the billed netto —
confirm which figure the cell shows per design: the netto). Color comes from `TRANSFER_TYPE_COLORS`.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B7 (netto ≤ brutto): unit on the form schema refine + validate hook — a net-type line with
  `netAmount > amount` is rejected.
- Full unit suite passes: `pnpm exec vitest run`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Adding a "Wydatek inwestycyjny netto" line: the netto field appears, `netAmount > amount` is blocked,
  submit persists both amounts.
- The transaction list shows the net-type row at its netto amount in the new color.
- The source register drops by brutto after the submit.

---

## Testing Strategy

### Unit Tests

- **B1** double-deduction (composition, Phase 3), **B2** kasa brutto (Phase 2), **B3** marża unmoved
  (Phase 2), **B4** no settled leak (Phase 2), **B5** list == summary (Phase 3), **B7** netto ≤ brutto
  (Phase 4). Bucket-assignment unit (Phase 2).
- Assert **observable state / returned aggregates**, not implementation internals (per AGENTS.md test
  guidance).

### Integration Tests

- None in this PR (B6 removed; kasa isolation asserted structurally at unit level).

### Manual Testing Steps

1. Add a net-type expense (brutto 1230, netto 1000) to an investment; confirm the source register
   drops by 1230.
2. Confirm "Do zapłaty R+M" and bilans inwestora rise by 1000.
3. Turn on the global "wszystko netto −8%" toggle; confirm the net-type row is unchanged and only
   brutto rows are cut.
4. Confirm marża is unchanged by the net-type expense.
5. Try `netAmount > amount` in the form; confirm rejection.

## Performance Considerations

Negligible — one extra `SUM(net_amount)` column in existing grouped queries; no new query, no new
round-trip. The editor payload gains two scalars.

## Migration Notes

Two hand-written migrations (enum value, then `net_amount` column), applied to the local dev DB.
Prod is a deliberate human step at deploy time (`pnpm db:migrate:prod`, `payload-prod-migrate` skill) —
NOT part of this local implementation task. Data is throwaway (kosztorys/spike scope) — no backfill.

## References

- Design/spec: `context/changes/netto-expense-type/design.md`
- Kasa isolation: `src/lib/db/sum-transfers.ts:35-64`
- Collapse point: `src/lib/db/investment-financials.ts:16-53`
- Toggle application: `src/lib/kosztorys/summary-economics.ts:33-42`
- Conditional-field precedent: `src/collections/transfers.ts:120-136` (`vatPlane`)
- Enum migration precedent: `src/migrations/20260212_191046_add_deposit_type.ts`
- Column migration precedent: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Type + schema foundation

#### Automated

- [ ] 1.1 Type checking passes: `pnpm generate:types && pnpm tsc --noEmit`
- [ ] 1.2 Constants test passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- [ ] 1.3 Both migrations apply cleanly to local dev DB: `pnpm payload migrate`

### Phase 2: Financial split (two buckets, kasa/marża untouched)

#### Automated

- [ ] 2.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 2.2 B2 (kasa brutto): net-type ∉ DEPOSIT_TYPES, register CASE treats it as outflow at `amount`
- [ ] 2.3 B3 (marża unmoved): marża identical across the two types for an unsettled expense
- [ ] 2.4 B4 (no settled leak): net-type never routed to `totalSettled`; `canBeSettled` false
- [ ] 2.5 Bucket assignment: net-type lands in `materialsNetTypeNetto`, never in `materialsBruttoBase`

### Phase 3: Editor threading + toggle composition

#### Automated

- [ ] 3.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 3.2 B1 (no double deduction): net-type contribution equals `netAmount` exactly with toggle on
- [ ] 3.3 B5 (list == summary): net-type aggregate contribution equals stored `netAmount`
- [ ] 3.4 Existing kosztorys economics unit tests still pass

### Phase 4: Create form + transaction list

#### Automated

- [ ] 4.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 4.2 B7 (netto ≤ brutto): net-type line with `netAmount > amount` rejected (schema + hook)
- [ ] 4.3 Full unit suite passes: `pnpm exec vitest run`
- [ ] 4.4 Lint passes: `pnpm lint`
