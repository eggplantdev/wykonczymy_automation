# „Pozostało do wypłaty" on the investments listing — Implementation Plan

## Overview

Add a „Pozostało do wypłaty" column to the investments listing. It shows what the crews are still
owed for executed kosztorys work, per investment, so the owner can scan where a payout is due. It is
the same figure as the kosztorys summary → „Podwykonawcy" headline:
„Suma wykonanej pracy" − „Zaliczki (wypłaty)".

## Current State Analysis

The listing already carries both operands for every investment. Research:
`context/changes/2026-09-29-investments-list-payout-remaining/research.md`.

- **Należne:** `subcontractorDueRecord[id]` → `{ due, hasUnconfirmedPlane }` comes from
  `selectKosztorysSubcontractorDue` (`src/lib/db/kosztorys-subcontractor-due.ts:26-81`). It is the
  SQL twin of the editor's `subcontractorDueByPlane` and is pinned to it by
  `src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts`. Today its only consumer is `marginV2`
  (`src/lib/queries/shape-investments.ts:99-100`).
- **Zaliczki:** `financials.totalPayouts` (`src/lib/db/investment-financials.ts:110`) counts
  non-cancelled `PAYOUT` rows scoped to the investment. That is the same row set the panel reads
  through `getPayoutTransactionsForInvestment`.
- **The panel's figure:** `computeSubcontractorSummary(...).remaining = roundToCents(dueNet − payoutsTotal)`
  (`src/lib/kosztorys/subcontractor-summary.ts:135`). It is not clamped, and negatives render red.

Nothing on the listing combines the two yet.

## Desired End State

The listing shows a „Pozostało do wypłaty" column to every role that can open the listing.

| Investment state | Cell |
|---|---|
| Kosztorys present, all etapy with work have a rozliczenie | `należne − wypłaty`, grosz-rounded; a negative value is red |
| Some etap has executed work but no rozliczenie | „ustaw etapy" (withheld) |
| No kosztorys | „brak danych" |

- Withheld rows sort last.
- The column is part of the „Kolumny v2" switch.
- The DB parity spec proves that the listing figure equals the Podwykonawcy headline for every
  investment in the dataset.

### Key Discoveries:

- The Marża v2 cell (`src/components/tables/investments.tsx:167-186`) is the exact precedent: it
  uses `sortUndefined: 'last'`, „brak danych" via `hasKosztorysReading`, and „ustaw etapy" when the
  row field is `undefined`.
- `BalanceCell` (`src/components/ui/balance-cell.tsx`) already paints negatives with
  `text-destructive`, which matches the panel's red.
- `V2_COLUMN_IDS` (`investments.tsx:27-32`) is the single list the „Kolumny v2" switch toggles. It
  is visible by default.
- Glossary: the canonical id is `subcontractorDue`, and `remaining` stays bare only inside the
  subcontractor summary (`context/domain/02-glossary.md:56, 135`). On the listing row, which also
  carries `balance`, the field is `subcontractorRemaining`.
- The parity spec (`src/__tests__/investment-render-parity-db.test.ts:214-229`) already builds the
  tree and `subcontractorDueByPlane` for Marża v2. The new comparison reuses that `byPlane`.

## What We're NOT Doing

- No new SQL, no cache-key bump, no new cache tag. Both operands are already fetched and invalidated
  correctly: `transfers` for wypłaty, the kosztorys tags for należne.
- No role gate. The owner chose all management roles, unlike „Wypłaty" / „Marża", which stay
  admin/owner-only.
- No hint icon or label for overpayment. A red number only; the „Nadpłata" vs „Wypłacono więcej niż
  wykonano" wording question stays open elsewhere.
- No golden-master field. The figure is a subtraction of `totalPayouts` and należne, both already
  pinned, and the parity spec pins it against the panel directly.
- No per-worker breakdown. That is the employee-card change
  (`context/changes/2026-09-03-worker-payouts-on-employee-card`).
- No change to the panel's own display of an unconfirmed plane. It keeps showing the short figure
  with a hint.

## Implementation Approach

Derive the field inside `shapeInvestments`, next to `marginV2`, from the two operands it already
holds. Render it with the Marża v2 cell pattern. Prove it against the panel's real function in the
DB parity spec.

## Critical Implementation Details

- **Absence carries two meanings; the cell tells them apart.** The field is `undefined` both when
  there is no kosztorys and when a plane is unconfirmed, so both sort last. The cell picks
  „brak danych" versus „ustaw etapy" from `hasKosztorys`, exactly as Marża v2 does.
  - Withholding on no kosztorys is deliberate. Otherwise the value would be `−wypłaty`, and a sort
    would scatter hidden legacy investments among the real overpayments.
  - An investment WITH kosztorys items but no executed work has `due = 0` (no fold row →
    `NOTHING_DUE`). It shows `−wypłaty` in red. That is correct: the crews were paid ahead of the
    work.
- **Parity must compare withheld with withheld.** The panel never withholds, so the detail side of
  the parity check applies the same `hasUnconfirmedPlane` rule before comparing. Otherwise every
  unconfirmed investment is a false mismatch.

## Phase 1: Row field

### Overview

Compute `subcontractorRemaining` per listing row, test-first.

### Changes Required:

#### 1. Row contract

**File**: `src/types/table-rows.ts`

**Intent**: Add the figure to the listing row, documented like `marginV2`, including why it is
`undefined` rather than `null`.

**Contract**: `InvestmentRowT.subcontractorRemaining?: number`. Absent when the investment has no
kosztorys, or when some etap holds executed work with no rozliczenie.

#### 2. Row assembly

**File**: `src/lib/queries/shape-investments.ts`

**Intent**: Derive the figure from the należne already looked up for `marginV2` and from
`financials.totalPayouts`, rounded like the panel's headline. Hoist the
`subcontractorDueRecord[String(inv.id)] ?? NOTHING_DUE` lookup once and share it between the two
figures.

**Contract**:
`subcontractorRemaining = clientTotals === undefined || settlement.hasUnconfirmedPlane ? undefined : roundToCents(settlement.due − financials.totalPayouts)`.

#### 3. Unit tests

**File**: `src/__tests__/lib/queries/shape-investments.test.ts`

**Intent**: Add a `describe('shapeInvestments pozostało do wypłaty')` block next to the marża v2
block, reusing its fixtures. Cover:
- a positive remainder
- a negative remainder (payouts above należne)
- withholding on `hasUnconfirmedPlane`
- withholding without a kosztorys
- a kosztorys with no executed work, which reads `−wypłaty`
- float residue rounding to exactly 0 (e.g. należne `0.1 + 0.2` against wypłaty `0.3`)

**Contract**: the operands must differ from marża v2's inputs, so a figure accidentally reading
`marginV2`'s terms fails.

### Success Criteria:

#### Automated Verification:

- New unit specs pass: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`

#### Manual Verification:

- None for this phase (no UI yet).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Column + parity

### Overview

Render the column and pin it against the Podwykonawcy panel on real data.

### Changes Required:

#### 1. Column

**File**: `src/components/tables/investments.tsx`

**Intent**: Add the „Pozostało do wypłaty" column, ungated, with the Marża v2 cell logic:
- „brak danych" when `!hasKosztorysReading(row)`
- „ustaw etapy" when the value is `undefined`
- `BalanceCell` otherwise

Place it next to „Marża v2" / the „Wypłaty" group. Add its id to `V2_COLUMN_IDS`.

**Contract**: column id `subcontractorRemaining`, `sortUndefined: 'last'`, `meta.align: 'right'`,
`meta.tooltip: INVESTMENT_HEADER_TIPS.subcontractorRemaining`. The header label comes from
`SUBCONTRACTOR_FIGURE_LABELS.remaining` (`src/lib/kosztorys/labels.ts:27`), so the listing and the
panel share one string.

#### 2. Header tooltip

**File**: `src/components/tables/investments-header-tips.ts`

**Intent**: Explain the figure in Polish, in the style of the neighbouring tips:
- what is owed to the crews for executed etapy (pre-rabat, each etap at its rozliczenie's price),
  minus the „Wypłata" transfers
- that it is the same amount as the kosztorys summary's „Podwykonawcy" tab
- that a minus means the crews were paid more than they executed
- what „ustaw etapy" and „brak danych" mean

**Contract**: new key `subcontractorRemaining`. Don't reuse `FROM_KOSZTORYS`, which names
robocizna and rabat, and neither feeds this figure.

#### 3. Listing ↔ panel parity

**File**: `src/__tests__/investment-render-parity-db.test.ts`

**Intent**: For each investment, compute the panel's figure with its real function:
`computeSubcontractorSummary(byPlane.combined, derivePayoutsByWorker(await getPayoutTransactionsForInvestment(payload, inv.id), []))`.
- Apply the listing's withholding rule on the detail side: withheld when there is no kosztorys or
  `byPlane.hasUnconfirmedPlane`.
- Compare it with `listingRow.subcontractorRemaining`, handling the withheld state the way the
  marża v2 comparison handles `null`.
- Push a labelled mismatch on disagreement.

**Contract**: reuse the `byPlane` the marża v2 block already builds; do not call the SQL fold on the
detail side. The workers roster is irrelevant to `.remaining`, so pass `[]`.

### Success Criteria:

#### Automated Verification:

- Parity spec passes against `db-test`: `pnpm test:parity`

#### Manual Verification:

- On `/inwestycje` as OWNER, the „Pozostało do wypłaty" column shows. For the investment in the
  request screenshot, it reads the same amount as its kosztorys → Podsumowanie → Podwykonawcy
  „Pozostało do wypłaty" (11 972,01 at the time of the request).
- An investment with no kosztorys shows „brak danych". One with an etap lacking a rozliczenie shows
  „ustaw etapy". Both sort last.
- An overpaid investment shows a red negative amount.
- Unticking „Kolumny v2" hides the column together with the other v2 columns.
- Logged in as MANAGER, the column is visible.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `shapeInvestments` derivation: sign, rounding, both withholding paths, and kosztorys-without-work
  (Phase 1).

### Integration Tests:

- `investment-render-parity-db.test.ts`: listing vs the panel's `computeSubcontractorSummary` on the
  restored prod dump (Phase 2).

### Manual Testing Steps:

1. Open `/inwestycje`, find an investment with executed etapy and payouts, and compare its cell
   with the kosztorys Podwykonawcy tab.
2. Sort the column both ways and confirm the withheld rows stay last.
3. Toggle „Kolumny v2".

## Performance Considerations

None. The change is one subtraction per row over data already in memory.

## Migration Notes

None. There is no schema change and no cached payload shape change, because `InvestmentRowT` is
built after the caches.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`

## References

- Research: `context/changes/2026-09-29-investments-list-payout-remaining/research.md`
- Cell precedent: `src/components/tables/investments.tsx:167-186` (Marża v2)
- Panel figure: `src/lib/kosztorys/subcontractor-summary.ts:84-136`
- Origin of the figures: `context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md` (EX-554)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Row field

#### Automated

- [x] 1.1 New unit specs pass: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`

### Phase 2: Column + parity

#### Automated

- [ ] 2.1 Parity spec passes against `db-test`: `pnpm test:parity`
