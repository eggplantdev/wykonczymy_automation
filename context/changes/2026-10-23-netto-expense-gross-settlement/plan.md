# Netto expense bills netto plus the investment's VAT when materiały settle brutto — Implementation Plan

## Overview

With „Sposób rozliczenia materiałów: brutto” a wydatek inwestycyjny netto (`INVESTMENT_EXPENSE_NET`) is
still billed at its frozen netto. Ruling (2026-10-23): under brutto settlement it stays a special case and
bills its netto grossed by the investment's VAT rate — `netto × (1 + vatRate)`. Netto settlement is
unchanged.

## Current State Analysis

- `billedMaterials` (`src/lib/kosztorys/summary-economics.ts:29`) always adds `materials.netBilled`
  (Σ `net_amount`), whatever the rate.
- `breakdownRowPair` (`src/lib/kosztorys/breakdown-rows.ts:8`) prices a `netBilled` row at
  `faceValue(row.net)` when the rate is null.
- Every `billedMaterials` caller already holds the investment's `vatRate` (`computeAmountDue`,
  `summary-overview-tab.tsx:81`, `shape-investments.ts:35`, `acceptance-protocol/settlement.ts:41`);
  `summary-expenses-tab.tsx` holds it but does not pass it to `MaterialsBreakdownTable`.

### Key Discoveries:

- `effectiveMaterialsNetRate(mode, rate)` (`settlement-mode.ts:44`) is null for GROSS — the predicate every
  consumer already holds.
- The mode is toggled optimistically on the client, so the choice stays in the pure functions taking
  `netRate`; `deriveFinancials` and `MaterialsT` are untouched.
- Both reported cases fit: Mirabelki (23%) 3662,38 × 1,23 = 4504,73; Polis (8%) 5276 × 1,08 = 5698,08.

## Desired End State

At brutto settlement (effective rate null):
- „Pozostało do zapłaty”, „Wydatki inwestycyjne”, the acceptance protocol and the investments list bill a
  netto expense at `netto × (1 + vatRate)`.
- The breakdown table shows one row per category (no separate „<kategoria> netto” row).

At netto settlement with a rate: every figure as today.

## What We're NOT Doing

- „Lista wydatków” — it lists the invoices' own netto / brutto, not the billed figure; unchanged.
- Sheet sync (`src/lib/google/tab-rows.ts:48`), v1 figures, marża v2.
- No migration, no data change.

## Implementation Approach

`billedMaterials` and `breakdownRowPair` take the investment's `vatRate` and gross the netto bucket by it
when `netRate == null`.

## Phase 1: Billing math

### Overview

The pure functions gross the netto bucket by the investment's VAT when the effective rate is null. Failing
specs first.

### Changes Required:

#### 1. Economics

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: `billedMaterials(materials, netRate, vatRate)` adds `toGross(netBilled, vatRate)` when
`netRate == null`, else `netBilled`. `computeAmountDue` passes its `vatRate` through.

#### 2. Breakdown rows

**File**: `src/lib/kosztorys/breakdown-rows.ts`

**Intent**: `breakdownRowPair(row, rate, vatRate)` prices a `netBilled` row at
`faceValue(toGross(row.net, vatRate))` when the rate is null; `pricedBreakdownRows` /
`categoryBreakdownRows` take `vatRate` too.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts src/__tests__/lib/kosztorys/breakdown-rows.test.ts` — new cases (rate null → netto × (1 + VAT); rate set → frozen netto) fail before the fix, pass after

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Callers and breakdown table

### Overview

Every caller passes `vatRate`; the breakdown table merges by category under brutto.

### Changes Required:

#### 1. Callers

**Files**: `src/lib/queries/shape-investments.ts`, `src/lib/kosztorys/acceptance-protocol/settlement.ts`,
`src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`

**Intent**: pass the investment's `vatRate` to `billedMaterials`.

#### 2. Breakdown table

**Files**: `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx`,
`src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`

**Intent**: new prop `vatRate: number`; when `netRate == null`, merge by category
(`categoryBreakdownRows`).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts src/__tests__/lib/kosztorys/acceptance-protocol/settlement.test.ts src/__tests__/components/kosztorys/summary/` — a brutto-mode case bills the netto expense at netto × (1 + VAT); the breakdown merges by category

#### Manual Verification:

- Local DB, Karol Pawlak Mirabelki 5/93 → podsumowanie kosztorysu, „Wydatki”: the category holding the ISM
  invoices shows 4504,73 within one row; „Pozostało do zapłaty” moves by +842,35 against today.
- Mateusz Polis (Hilarego Koprowskiego 11m12): switch materiały to brutto → the netto expense counts
  5698,08. Switch back to netto (8%) → 5276 as before.
- Lista inwestycji: Mirabelki's „Wydatki inwestycyjne” and bilans match the panel.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Report: Bartek, 21.10.2026 (change.md).
- Previous change: `context/archive/2026-07-29-netto-expense-grossup/`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Billing math

#### Automated

- [x] 1.1 Economics and breakdown-rows specs: new brutto-mode cases red, then green

### Phase 2: Callers and breakdown table

#### Automated

- [ ] 2.1 shape-investments, acceptance-protocol and summary component specs pass
