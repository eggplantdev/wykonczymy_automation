# Screaming Reconciliation Indicator Implementation Plan

## Overview

During the transition from manual `LABOR_COST`/`RABAT` transfers to reading robocizna/rabat from the
kosztorys, the owner needs to verify — per investment, by eye — that the two sources agree before
flipping that investment's "verified" flag. This plan builds the verification instrument: inside the
kosztorys editor's Podsumowanie, compare the investment's transaction-sourced robocizna and rabat
against the kosztorys client-view figures, and **scream on mismatch** (bold red figure + red `!` icon +
explanatory tooltip). Read-only, no writes, no schema change.

## Current State Analysis

- The kosztorys editor page (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:43`) already
  computes the full `financials` object via `deriveFinancials`. `totalLaborCosts` (Σ `LABOR_COST`) and
  `totalRabat` (Σ `RABAT`) sit on it but are **not read or threaded** into the editor. Both are the raw
  summed `amount` — no VAT applied anywhere (`investment-financials.ts:44,46`; the transfer schema has
  no vat field).
- „Suma prac wykonanych" at **client view** already exists in the hook: `doneNet`
  (`use-kosztorys-editor.ts:314`) = `sectionSubtotalsForView(rows, stages, 'client')` net, pre-rabat,
  view-independent. It is already returned from the hook (`:1027`).
- The current `rabatAmount` (`use-kosztorys-editor.ts:339`) is derived from the **active-view**
  `totalNet`/`subtotals`, so it moves with the price-view toggle — unusable for a fixed comparison.
- `toGross(net, vatRate)` exists (`src/lib/kosztorys/calc.ts:63`); `moneyPair` in `summary-economics.ts`.
- Tooltip primitive exists: `src/components/ui/tooltip.tsx` (and `info-tooltip.tsx`).
- Podsumowanie renders „Suma prac wykonanych" (`kosztorys-podsumowanie.tsx:120`) and the „Rabat" line
  (`:143`), the latter gated on `hasDiscount = rabatAmount > 0`.

## Desired End State

Opening the Podsumowanie on an investment whose kosztorys figures disagree with its `LABOR_COST` /
`RABAT` transfers shows the mismatched figure in **bold red with a red `!`**; hovering the `!` explains
what disagrees (kosztorys client-view gross vs the transaction sum) and by how much. When they agree
(to the grosz), the block renders exactly as today. Flipping the price-view toggle never changes the
verdict — the comparison is locked to client view. Verify: seed an investment where Σ `LABOR_COST` ≠
`toGross(„Suma prac wykonanych")`, open the panel, see the scream; correct the transfer, see it clear.

### Key Discoveries:

- `financials.totalLaborCosts` / `financials.totalRabat` are computed at `page.tsx:43` and just need
  threading — no new query.
- `doneNet` is the ready-made client-view executed net; only a client-view **rabat** net must be added.
- Transaction amounts are raw (net/gross-agnostic); the kosztorys side is grossed via `toGross`, so a
  historically net-typed transfer legitimately trips the `!` — that is the instrument working.

## What We're NOT Doing

- NOT changing where marża/bilans source robocizna/rabat (that is the later read-switch — separate).
- NOT adding the per-investment "verified/populated" flag or disabling the transfer types (later slices).
- NOT touching `deriveFinancials`, transfer collection, migrations, or the Sheets mirror.
- NOT showing a positive "match" affirmation — silent when equal, scream only on mismatch.

## Implementation Approach

Thread the two investment figures from the server page into `KosztorysEditorV2`. In the editor, which
already holds the hook's return and the server props, assemble a small `reconciliation` object (expected
kosztorys gross, actual transaction figure, mismatch flag) for robocizna and rabat, and pass it through
`KosztorysTotalsPanel` into `KosztorysPodsumowanie`, which renders the scream. The hook gains one figure
(client-view rabat net) alongside the existing `doneNet`.

## Critical Implementation Details

**Comparison basis (load-bearing).** Both figures compare **gross vs gross, client-view, tolerance one
grosz**. Kosztorys side = `toGross(clientNet, tree.vatRate)`; transaction side = the raw
`totalLaborCosts`/`totalRabat` (treated as gross). Tolerance is exact **grosz equality** on rounded
values — `Math.round(expected * 100) !== Math.round(actual * 100)` — not a fuzzy epsilon, so sub-grosz
`toGross` rounding never false-fires.

**Zero handling (confirmed).** Scream on any >1gr difference, INCLUDING kosztorys-nonzero vs
transaction-zero — that "transfer not entered yet" gap is the main thing population must catch. Both
sides zero ⇒ equal ⇒ silent.

**Force-show the rabat line (confirmed).** Today the „Rabat" row is gated on kosztorys `rabatAmount > 0`.
A `RABAT` transfer with an empty kosztorys rabat must still surface, so the row renders whenever EITHER
the kosztorys rabat OR the transaction rabat is non-zero (or a mismatch exists).

## Phase 1: Wire investment figures + client-view rabat, assemble reconciliation

### Overview

Get both sides of each comparison to meet in `KosztorysEditorV2`, and hand a ready-made verdict down to
the summary block.

### Changes Required:

#### 1. Server page threads the two investment figures

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Read `totalLaborCosts` and `totalRabat` off the already-computed `financials` and pass them
into the editor as the transaction-sourced robocizna/rabat.

**Contract**: Add props `investmentRobocizna={financials.totalLaborCosts}` and
`investmentRabat={financials.totalRabat}` to `<KosztorysEditorV2>`. No new fetch.

#### 2. Hook exposes a fixed client-view rabat net

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Add a view-independent client-view rabat net (the sibling of `doneNet`), computed off the
`'client'` pass rather than the active view, so the rabat comparison doesn't move with the toggle.

**Contract**: New memo `rabatClientNet` = `globalDiscountAmount(doneNet, globalDiscount)` + Σ
`progressSubtotals[].discount` (the `'client'` subtotals already memoized at `:310`). Add `rabatClientNet`
to the hook's returned object alongside the existing `doneNet` (`:1027`).

#### 3. Editor assembles the reconciliation object

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Intent**: With the hook return (`doneNet`, `rabatClientNet`) and the new server props in scope, build
one `reconciliation` object carrying, per figure, the expected kosztorys gross, the actual transaction
figure, and the mismatch flag; pass it to `KosztorysTotalsPanel`. Accept the two new props on the
component's `PropsT`.

**Contract**: A colocated helper produces
`{ robocizna: ReconT; rabat: ReconT }` where
`type ReconT = { expectedGross: number; actualGross: number; mismatch: boolean }`,
`expectedGross = toGross(clientNet, tree.vatRate)`, `actualGross = investment{Robocizna|Rabat}`,
`mismatch = Math.round(expectedGross*100) !== Math.round(actualGross*100)`. `ReconT` colocates with the
component per the contract-types rule.

#### 4. Totals panel forwards reconciliation

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: Pass-through only — accept `reconciliation` and forward it to `KosztorysPodsumowanie`.

**Contract**: Add `reconciliation` to `PropsT`; forward unchanged. No logic.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The editor renders unchanged (no visual delta yet) with the new props threaded.

---

## Phase 2: Render the scream in Podsumowanie

### Overview

Turn the reconciliation verdict into the bold-red-`!`-plus-tooltip UI on the „Suma prac wykonanych" and
„Rabat" rows.

### Changes Required:

#### 1. Podsumowanie renders the mismatch indicator

**File**: `src/components/kosztorys/kosztorys-podsumowanie.tsx`

**Intent**: Accept `reconciliation`; when a figure mismatches, render its value bold red and append a red
`!` icon whose tooltip states the kosztorys client-view gross, the transaction sum, and the delta. Apply
to the „Suma prac wykonanych" row (robocizna verdict) and the „Rabat" row (rabat verdict).

**Contract**: Add `reconciliation: { robocizna: ReconT; rabat: ReconT }` to `PropsT`. The row helper
gains a mismatch branch: red bold figure (`text-destructive font-bold`) + a small `!` (lucide
`TriangleAlert` / `CircleAlert`, `text-destructive`) wrapped in the `ui/tooltip` primitive. Force-render
the „Rabat" row when `rabatAmount > 0 || reconciliation.rabat.actualGross > 0 || reconciliation.rabat.mismatch`
(replacing the bare `hasDiscount` gate).

#### 2. Tooltip copy

**File**: `src/components/kosztorys/kosztorys-podsumowanie.tsx` (same change)

**Intent**: A short Polish explanation so the owner knows what disagrees and by how much.

**Contract**: e.g. „Kosztorys (brutto, ceny klienta): {expected}. Transakcje robocizny: {actual}.
Różnica: {delta}. Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej." (rabat variant swaps the
noun). English code comment explains the why per repo convention.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-reconciliation.test.ts`

#### Manual Verification:

- Seed an investment where Σ `LABOR_COST` ≠ `toGross(client „Suma prac wykonanych")`; open the panel →
  the „Suma prac wykonanych" figure is bold red with a red `!`; tooltip shows both figures + delta.
- A `RABAT` transfer with an empty kosztorys rabat force-shows the „Rabat" row with the scream.
- Toggling the price view (client ↔ subcontractor) does not change either verdict.
- When both sides agree to the grosz, the block renders exactly as before (no red, no `!`).

---

## Testing Strategy

### Unit Tests:

- A pure reconciliation helper (extracted from the editor's assembly step) is the unit surface:
  `src/__tests__/kosztorys-reconciliation.test.ts`. Cases: equal-to-grosz ⇒ no mismatch;
  1-grosz-over ⇒ mismatch; kosztorys-nonzero vs transaction-zero ⇒ mismatch; both-zero ⇒ no mismatch;
  sub-grosz `toGross` rounding ⇒ no false mismatch.

### Manual Testing Steps:

1. Seed mismatching robocizna → open panel → verify red `!` + tooltip on „Suma prac wykonanych".
2. Seed matching figures → verify silent render.
3. Seed `RABAT` transfer + empty kosztorys rabat → verify forced „Rabat" row scream.
4. Toggle price view → verify verdict is stable.

## Performance Considerations

Negligible — two extra numbers threaded, one extra client-view memo (reusing the already-computed
`progressSubtotals`), one comparison. Nothing touches the render-hot grid path.

## Migration Notes

None. Read-only; no schema, no data change. Kosztorys data is throwaway pre-dogfooding.

## References

- Research: `context/changes/robocizna-from-kosztorys/research.md`
- Change brief: `context/changes/robocizna-from-kosztorys/change.md`
- Client-view executed net: `src/components/kosztorys/use-kosztorys-editor.ts:314`
- Transaction sums: `src/lib/db/investment-financials.ts:44,46`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wire investment figures + client-view rabat, assemble reconciliation

#### Automated

- [ ] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [ ] 1.2 Linting passes: `pnpm lint`

### Phase 2: Render the scream in Podsumowanie

#### Automated

- [ ] 2.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [ ] 2.2 Linting passes: `pnpm lint`
- [ ] 2.3 Unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-reconciliation.test.ts`
