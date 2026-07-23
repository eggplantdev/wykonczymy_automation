# Tryb mieszany — cash-settlement view in kosztorys Podsumowanie (slice B) Implementation Plan

## Overview

Replace the meaning of the Podsumowanie panel's „Mieszana" axis (`moneyAxis === 'both'`). Today it
renders netto **and** brutto columns side by side. After this change „Mieszana" becomes a
**cash-settlement view**: netto-only figures plus a local per-investment cash-amount input `C` and a
three-row settlement block deriving the total owed once VAT is re-added to the non-cash remainder.

Netto-only, no persistence, no transactions/bilans changes — the reconciliation divergence is
accepted and deferred to a later VAT-aware slice (scope lock below).

## Current State Analysis

- The panel owns its axis as local `useState(MONEY_AXIS_DEFAULT)` (`kosztorys-totals-panel.tsx:102`),
  **independent** of the grid toolbar's axis (`use-money-axis.ts`, persisted). `MONEY_AXIS_DEFAULT`
  (`'both'`) is shared by the grid columns (`kosztorys-v2-columns.tsx:448`) and the grid toggle — so
  the panel default must be changed via a **panel-scoped** const, not by touching the shared one.
- `axisShows('both')` → `{ net: true, gross: true }` (`money-axis.ts:14`). The panel fans `moneyAxis`
  into `KosztorysSummary`, `SummaryTotalsTable` (via KosztorysSummary), and `KosztorysStageTotals`,
  each calling `axisShows` to decide netto/brutto columns.
- `D` already exists: `computeDoZaplatyRM(...).net` — robocizna + materiały − wpłaty, all netto
  (`summary-economics.ts:88`). Computed once in the panel (`kosztorys-totals-panel.tsx:109`) and
  passed down, so the cash block reads the same `D`.
- `toGross(net, vatRate)` and `formatNet` are the money primitives; `SummaryTable` / `SummaryRow` /
  `SummaryHeaderCell` in `summary-grid.tsx` are the shared grid cells (13rem label + 7rem value
  tracks). An `Input` primitive exists at `components/ui/input.tsx`.
- `clientView` is a separate read-only render flag; the toggle renders regardless of it.

### Key Discoveries:

- The braindump's `((D − C) − Mn)·(1+VAT) + Mb` collapses to the uniform `(D − C)·(1+VAT)` because
  materiały are already netto inside `D` (one VAT rate) — shape.md §The math.
- The panel's axis `useState` is isolated from the grid, so flipping the panel default to `'net'`
  cannot regress the grid. Only the const source must be panel-scoped.
- `SummaryRow` supports a `bold` figure and a `discount` (green) figure — reused for the cash rows so
  they align with the existing waterfall grid instead of a bespoke table.

## Desired End State

> **⚠️ Reconciled 2026-07-22 (review gate) — shipped differently from this plan in three ways.** Read
> the code (`summary-economics.ts`, `kosztorys-totals-panel.tsx`, `cash-settlement.tsx`) as truth:
>
> 1. **„Mieszane" is a NEW toggle value, not a repurpose.** The toggle keeps „Netto + Brutto" and adds
>    a fourth „Mieszane" (`'cash'`) option. In cash mode both netto and brutto columns stay visible
>    (`displayAxis='both'`) — the waterfall + Suma transzy are **not** netto-only as planned below.
> 2. **`computeCashSettlement` is a 4-arg / 6-field function anchored on Łącznie netto** (see the
>    corrected contract in Phase 1), not the 3-field `doZaplatyNet`-anchored one. wpłaty are subtracted
>    AFTER grossing (the plan's form would have grossed the deposits, inventing VAT).
> 3. **A deposits-reconciliation block shipped alongside** (`deposits-reconciliation.tsx` +
>    `depositsSplit` / `bucketDepositsByPlane`), reconciling wpłaty per VAT plane against the settlement.
>    The plan does not mention it. Deposits carry a stored `vatPlane` flag (NET/GROSS/null, **null⇒netto**
>    per the 2026-07-23 flip — only GROSS is invoiced; NET and null pay gotówka).
> 4. **The gotówka amount is NOT typed — it is derived** (commits `9d0a2fa4` + `768e0d50`, 2026-07-23):
>    „Do rozliczenia netto" = Σ wpłaty oznaczone netto (incl. unmarked) = `bucketDepositsByPlane(deposits).paidNet`.
>    The plan's editable `C` input and its `clientView` read-only variant were removed — there is no
>    manual cash field.
>
> The `clientView` read-only-input behaviour below is accurate. The rest of this section is the
> original plan, kept as history.

In the client plane of the Podsumowanie panel:

- Panel opens on **Netto** by default (not the old „Mieszana").
- Selecting **Mieszane** appends a six-row cash-settlement waterfall (Całość netto → **Do rozliczenia
  netto** → Reszta netto → Reszta brutto → Wpłaty → **Razem do zapłaty**, bold), beside a per-plane
  deposits reconciliation. „Do rozliczenia netto" is **derived** — Σ wpłaty oznaczone netto (unmarked
  count as netto), not a typed input.
- No manual cash field, so nothing to gate in `clientView`; the block renders read-only figures.
- Netto / Brutto axes behave as before. Grid columns and grid toggle are unchanged.

Verify: open the panel on an investment with wpłaty, switch to Mieszane → „Do rozliczenia netto"
equals the sum of the netto-flagged (and unmarked) wpłaty, and the waterfall / „Pozostało" figures
follow it; with no netto wpłaty, Razem = the Brutto-axis „Do zapłaty".

## What We're NOT Doing

- **Not** touching `src/lib/db/investment-financials.ts`, `calculate-balance.ts`,
  `calculate-margin.ts`, or the transactions model (owner scope lock). Bilans won't reconcile —
  accepted, not a bug.
- **Not** persisting `C` (local state only, resets on unmount) — a later slice.
- **Not** making materiały brutto/netto VAT-aware in transactions — deferred.
- **Not** changing the grid's axis, grid columns, or `MONEY_AXIS_DEFAULT`.
- **Not** changing the collapsed headline's figure (stays „Do zapłaty" netto in cash mode).

## Implementation Approach

Two phases. Phase 1 adds a pure settlement helper with a unit test (fully TDD-able). Phase 2 wires the
panel: a panel-scoped `'net'` default, a `cashMode` branch that coerces the existing children to a
netto-only display axis, and a new `CashSettlement` component (input + three rows) built on the shared
summary-grid primitives so it aligns with the waterfall.

## Phase 1: Cash-settlement math helper

### Overview

A pure function deriving the three cash figures from `D`, `C`, and the VAT rate. Home is
`summary-economics.ts` alongside `computeDoZaplatyRM` — same plane, same file.

### Changes Required:

#### 1. Settlement helper

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: Add `computeCashSettlement` returning the cash/remainder/total triple for the mixed view.
Pure, no clamping — the caller allows `C > D`.

**Contract (as shipped — corrected 2026-07-22):**
`computeCashSettlement(combinedNet, wplatyNet, cashAmount, vatRate): { cash, combinedNet, remainderNet, remainderGross, invoice, total }`.
Anchored on **Łącznie netto** (`combinedNet`), not „Do zapłaty" netto: `remainderNet = combinedNet − cashAmount`,
`remainderGross = toGross(remainderNet, vatRate)`, `invoice = remainderGross − wplatyNet` (wpłaty subtracted
AFTER grossing — never grossed, so no invented VAT), `total = cashAmount + invoice`. No clamp — `C = 0`
lands on the Brutto-axis „Do zapłaty" (`combinedGross − wpłaty`); over-typing yields a negative remainder.
The deposits-reconciliation helpers `bucketDepositsByPlane` + `depositsSplit` live in the same file.

#### 2. Unit test

**File**: `src/__tests__/lib/kosztorys/summary-economics.test.ts` (new)

**Intent**: Lock the math and the boundary cases the shape calls out.

**Contract**: Cases — `C = 0` → `total = D·(1+VAT)`; `C = D` → `total = D`, `remainderGross = 0`;
`0 < C < D` → `total = C + (D−C)·(1+VAT)`; `C > D` → `remainderGross < 0` and `total < D`; `vatRate = 0`
→ `total = D`. Use a representative VAT (e.g. `0.23`).

### Success Criteria:

#### Automated Verification:

- Unit test passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`
- Type checking passes: `pnpm generate:types` not needed; `pnpm exec tsc --noEmit` (or the repo's typecheck script)

#### Manual Verification:

- None (pure function, covered by unit test).

---

## Phase 2: Panel wiring + cash-settlement UI

### Overview

Flip the panel default to netto, branch the `'both'` axis into a netto-only cash mode, and render the
`CashSettlement` block.

### Changes Required:

#### 1. Panel-scoped default axis

**File**: `src/lib/kosztorys/money-axis.ts`

**Intent**: Give the Podsumowanie panel its own default without disturbing the grid's `'both'` default.

**Contract**: Add `export const SUMMARY_AXIS_DEFAULT: MoneyAxisT = 'net'`. Leave `MONEY_AXIS_DEFAULT`
(`'both'`) unchanged.

#### 2. Panel: cash mode + netto-only coercion

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: Default the panel to netto; when the owner selects „Mieszana" enter cash mode — render the
existing children netto-only and append the cash block. Hold `C` as local state; make the input
read-only in `clientView`.

**Contract**:

- `useState<MoneyAxisT>(SUMMARY_AXIS_DEFAULT)` (was `MONEY_AXIS_DEFAULT`).
- `const [cashAmount, setCashAmount] = useState(0)`.
- `const cashMode = moneyAxis === 'both'`; `const displayAxis: MoneyAxisT = cashMode ? 'net' : moneyAxis`.
- Pass `displayAxis` (not `moneyAxis`) to `KosztorysSummary` and `KosztorysStageTotals`, and drive the
  collapsed headline's `axisShows` from `displayAxis` — so „Mieszana" shows netto-only everywhere the
  old both-columns used to appear.
- When `cashMode`, render `<CashSettlement doZaplatyNet={doZaplaty.net} vatRate={vatRate} cashAmount={cashAmount} onCashAmountChange={setCashAmount} readOnly={clientView} />` after `KosztorysSummary` (inside the same client-plane column, before or after `KosztorysStageTotals`).
- The „Mieszana" ToggleGroup option and its tooltip stay; only the branch behavior changes.

#### 3. CashSettlement component

**File**: `src/components/kosztorys/cash-settlement.tsx` (new)

**Intent**: The input row + three settlement rows, built on the shared summary-grid so it aligns with
the waterfall above it.

**Contract**: `PropsT = { doZaplatyNet: number; vatRate: number; cashAmount: number; onCashAmountChange: (n: number) => void; readOnly: boolean }`.
Calls `computeCashSettlement`. Renders a `SummaryTable` (netto single value track, `summaryMoneyCols('net')`):

- **Gotówką bez VAT** — a right-aligned numeric `Input` (`type="number"`, `min={0}`, `readOnly` when
  `readOnly`), parsing to a number and clamping only at the lower bound (`Math.max(0, …)`), `onCashAmountChange`.
- **Reszta z VAT** — `settlement.remainderGross` (green/`discount` styling optional; may be negative).
- **Razem do zapłaty** — `settlement.total`, `bold`.
  Use `formatNet` for the read-only figures. Guard: `stages`/`materiały` not needed here — only `D`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Existing panel tests (if any) pass: `pnpm exec vitest run src/__tests__/kosztorys`

#### Manual Verification:

- Panel opens on **Netto** by default; grid columns/toggle default unchanged (still show all).
- „Mieszana" shows netto-only waterfall + „Suma transzy" netto + the three cash rows.
- Typing `C` recomputes Reszta and Razem live; `C = 0` → Razem = `D·(1+VAT)`; `C = D` → Razem = `D`;
  `C > D` → Reszta negative, no crash.
- Netto and Brutto axes unchanged from before.
- Client preview (`clientView`) shows the block with a **disabled** input.

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation in
the browser before archiving.

---

## Testing Strategy

### Unit Tests:

- `computeCashSettlement` boundary cases (Phase 1) — the only pure logic worth a spec.

### Manual Testing Steps:

1. Seed/open an investment with positive „Do zapłaty" (`INV=6 node … seed-kosztorys.ts`).
2. Open the Podsumowanie panel → confirm it opens on Netto.
3. Switch to Mieszana → confirm netto-only figures + cash block; type several `C` values incl. `0`,
   `= D`, `> D`.
4. Open the client preview → confirm the input is read-only.

## References

- Shape: `context/changes/kosztorys-tryb-mieszany/shape.md`
- Slice A foundation (`grossPair` / materiały): `context/changes/kosztorys-zaliczka-v2/`
- `D` source: `src/lib/kosztorys/summary-economics.ts:88`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Cash-settlement math helper

#### Automated

- [x] 1.1 Unit test passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts` (cases added there, repo convention path) — 6d277554
- [x] 1.2 Type checking passes — 6d277554

### Phase 2: Panel wiring + cash-settlement UI

#### Automated

- [x] 2.1 Type checking passes: `pnpm exec tsc --noEmit` — 8953427c
- [x] 2.2 Lint passes: `pnpm lint` — 8953427c
- [x] 2.3 Existing panel tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys` — 8953427c
