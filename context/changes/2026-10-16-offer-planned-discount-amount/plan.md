# Rabat amount on przedmiar — Implementation Plan

## Overview

The offer an investor receives (share link, podgląd, PDF) shows the rabat % per pozycja, and its
„Wartość przedmiaru netto" is already after that rabat — but nothing shows the rabat in złoty, and
the header doesn't say the value is discounted. Add a „Rabat kwota netto (przedmiar)" column (plus a
brutto twin in the editor), and suffix the przedmiar value headers with „— po rabacie" whenever the
kosztorys carries a rabat.

## Current State Analysis

- „Wartość przedmiaru netto" (`plannedNet`) = przedmiar × cena − rabat — sheet column **S**
  (`calc.ts:155` `rowPlannedNetForView` → `netForQtyForView`, which applies the rabat on the client
  plane).
- „Rabat kwota netto" (`discountAmount`) is the rabat on **pomiar** (Σ etapów) — sheet column **T**'s
  rabat: `column-values.ts:70` calls `rowDiscountForView(row, totalQtyDone(row), view)`.
- Because it rides on pomiar, `discountAmount` is a settlement column (`settlement-columns.ts:5-11`):
  `investorEmptyColumnIds` hides it until some etap has an entry. In the offer phase it is therefore
  always hidden, on the share/podgląd (`use-kosztorys-editor.ts:483-491`) and in the PDF
  (`print/offer.ts:36-40`). Nothing shows the rabat in złoty on przedmiar.
- Investor-document disclosure: `PREVIEW_VISIBLE_COLUMNS` (ceiling, from `CLIENT_VIEW_GROUPS`) and
  `CLIENT_DOCUMENT_COLUMNS` (order) in `client-view/columns.ts`; code defaults in
  `client-view/settings.ts` — every rabat column is default-hidden (absent from
  `DEFAULT_VISIBLE_COLUMNS`). Stored settings are a `{ key: hidden }` map; an unmentioned key reads
  its **code** default (lessons.md „Stored preferences record the deviation"). `LEGACY_CLIENT_COLUMNS`
  is frozen — never extended.
- Labels: `COLUMN_LABELS` (static, also used by the „Opcje" checklist and other dialogs) and
  `columnLabelForView(id, view, dictionary)` (`column-config.ts:76`), called by the grid headers
  (`column-headers.tsx:74`), the editor column picker (`column-selection.ts:143,150`) and the PDF
  (`offer-columns.ts:31`). The PDF hard-codes `plannedNet`'s header as „Wartość netto"
  (`offer-columns.ts:52`).
- b921b9476 removed an unconditional „— po rabacie" from the executed-value column because it read
  as a granted rabat on offers without one. This plan's suffix is conditional, so that failure can't
  recur.
- Global rabat: `applyDiscount` ignores the per-row rabat when `globalDiscountActive`
  (`calc.ts:31`), and `bypassedByGlobalDiscount` hides every per-row rabat column then
  (`column-config.ts:165-176`).

## Desired End State

- The editor's column picker offers „Rabat kwota netto (przedmiar)" and „Rabat kwota brutto
  (przedmiar)", shown/hidden by the netto/brutto mode like their siblings, with footer totals.
- The investor „Opcje" lists „Rabat kwota netto (przedmiar)" in „Ceny i rabat", unticked by default.
  Ticked, it appears on the share/podgląd and in the PDF — unless no pozycja carries a rabat, in which
  case it is dropped as empty.
- When any pozycja carries a rabat (on its przedmiar), the headers of „Wartość przedmiaru
  netto/brutto" and „Wartość netto/brutto aktualizacji przedmiaru" read „… — po rabacie" in the
  editor, the share/podgląd and the PDF; without a rabat they are unchanged.
- Under a global rabat the new columns are bypassed like every per-row rabat column.
- Verify: a kosztorys with a 5 % rabat on 30 m × 45 zł shows 67,50 in the new column, 1282,50 in
  „Wartość przedmiaru netto — po rabacie", and the footer sums agree.

### Key Discoveries:

- `rowDiscountForView(row, qty, view)` (`calc.ts:171`) already computes the rabat for any quantity —
  the new value is that call with `row.plannedQty`, mirroring how `rowPlannedNetForView` wraps
  `netForQtyForView`.
- `computedColumnValues` (`column-values.ts`) is the single per-row value source for the grid,
  footer totals (`column-totals.ts`) and PDF (`offer-columns.ts`) — one entry there feeds all three.
- `settings-new-column.test.ts` is the existing pattern proving a column outside the legacy set takes
  its code default.
- The „Opcje" checklist labels come from the static `COLUMN_LABELS`; the „— po rabacie" suffix lives
  only in `columnLabelForView`, so the checklist keeps the plain name (it is a setting, not a header).

## What We're NOT Doing

- Not changing „Rabat kwota netto" (`discountAmount`) — it stays the rabat on pomiar.
- Not suffixing „Wartość netto (razem etapy)" (`net`/`gross`) — it has its own rabat column and its
  suffix was removed deliberately (b921b9476).
- No brutto rabat column in the investor document (it has no brutto columns at all).
- No auto-hide of the new column in the editor when there's no rabat — the editor shows what the
  picker says, like `discountAmount`.
- No global-rabat amount on przedmiar (global rabat's base is executed work).
- No migration, no DB change, no sheet-sync change.
- Not extending `LEGACY_CLIENT_COLUMNS`.

## Implementation Approach

One value, one predicate, one label rule — all in `src/lib/kosztorys/`, test-first — then wire them
into the three surfaces that already share `computedColumnValues` / `columnLabelForView`.

Identifiers: `plannedDiscountAmount` / `plannedDiscountAmountGross` (glossary: `discount`, and
`planned*` = przedmiar, as in `plannedNet` / `plannedGross`).

## Critical Implementation Details

- **Disclosure fails closed.** The new key must be absent from `DEFAULT_VISIBLE_COLUMNS` so every
  existing investment — where the owner may have hidden rabat on purpose — reads it as hidden.
- **The suffix predicate and the empty-column predicate are the same function.** „Has a rabat" =
  some row's `plannedDiscountAmount` ≠ 0 on the client plane. Using one helper keeps a ticked-but-
  empty column and an unsuffixed header from disagreeing; it is already 0 under a global rabat
  (`applyDiscount` bypass), so the global case needs no separate branch.

## Phase 1: Value, predicate and label rule (lib, test-first)

### Overview

Everything React-free: the per-row value, totals, the „has a rabat" predicate, the conditional label
and the column-config sets.

### Changes Required:

#### 1. Per-row value

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Add the rabat on przedmiar per row, next to `rowPlannedNetForView`.

**Contract**: `rowPlannedDiscountForView(row: ViewPricingT, view: PriceViewT): number` =
`rowDiscountForView(row, row.plannedQty, view)`. 0 on a crew plane, 0 under a global rabat, 0 when
przedmiar is 0.

#### 2. Column values and totals

**Files**: `src/lib/kosztorys/columns/column-values.ts`, `src/lib/kosztorys/columns/column-totals.ts`

**Intent**: Register `plannedDiscountAmount` (client plane, like `plannedNet`) and
`plannedDiscountAmountGross` (`grossOf`), and total both in the footer.

**Contract**: `computedColumnValues(...)('plannedDiscountAmount')` returns the row's rabat on
przedmiar; `columnTotalsForRows` sets `plannedDiscountAmount` and `plannedDiscountAmountGross`
(`toGross` of the net total).

#### 3. „Has a rabat" predicate and the empty-column rule

**File**: `src/lib/kosztorys/settlement-columns.ts`

**Intent**: One predicate deciding both the header suffix and whether the new column is empty in the
investor document; `investorEmptyColumnIds` marks `plannedDiscountAmount` empty when it is false.

**Contract**: `hasPlannedDiscount(rows: readonly KosztorysV2RowT[]): boolean` — some row's
`rowPlannedDiscountForView(row, 'client') !== 0`. `investorEmptyColumnIds` adds
`plannedDiscountAmount` to the empty set when `!hasPlannedDiscount(rows)`; it never joins
`SETTLEMENT_TOTAL_COLUMNS` (it must not wait for etapy).

#### 4. Labels, axis and global-rabat bypass

**File**: `src/lib/kosztorys/columns/column-config.ts`

**Intent**: Name the new columns, tag their money axis, bypass them under a global rabat, and suffix
the przedmiar value headers when the kosztorys has a rabat.

**Contract**:
- `COLUMN_LABELS`: `plannedDiscountAmount: 'Rabat kwota netto (przedmiar)'`,
  `plannedDiscountAmountGross: 'Rabat kwota brutto (przedmiar)'`.
- `COLUMN_MONEY_AXIS`: `'net'` / `'gross'`. `DISCOUNT_COLUMN_IDS`: both added.
- `columnLabelForView(id, view, dictionary, opts?: { hasDiscount?: boolean })` — when
  `view === 'client' && opts?.hasDiscount` and `id` is one of `plannedNet`, `plannedGross`,
  `currentPlannedNet`, `currentPlannedGross`, return `` `${label} — po rabacie` ``. Every other id and
  every crew plane is unchanged. Update the doc comment above the function: the suffix is
  conditional, which is what keeps b921b9476's failure (suffix on an offer without rabat) away.

#### 5. Header tip

**File**: `src/lib/kosztorys/header-tips.ts`

**Intent**: Explain the new columns like their neighbours.

**Contract**: `plannedDiscountAmount` / `plannedDiscountAmountGross` tip: „Przedmiar ofertowy razy
cena minus wartość przedmiaru — rabat w złotych na ofercie." + `CLIENT_BASE`.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts` — `rowPlannedDiscountForView`: percent and
  amount rabat, przedmiar 0, global rabat → 0, crew plane → 0
- `src/__tests__/lib/kosztorys/columns/column-values.test.ts` and `column-totals.test.ts` — new
  values and footer totals (net + gross)
- `src/__tests__/lib/kosztorys/settlement-columns.test.ts` — `hasPlannedDiscount`; the new column
  empty without a rabat, present with one and no etapy entries
- A `columnLabelForView` spec (under `src/__tests__/lib/kosztorys/columns/`) — suffix only on the
  client plane, only with `hasDiscount`, only on the four przedmiar value ids; `net` never suffixed;
  `bypassedByGlobalDiscount` covers both new ids

#### Manual Verification:

- None for this phase (no surface wired yet).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Wire the editor, the investor document and the PDF

### Overview

Put the columns on screen and paper, and feed `hasDiscount` to every header call site.

### Changes Required:

#### 1. Editor grid and picker

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/grid/column-headers.tsx`,
`src/components/kosztorys/editor/grid/column-selection.ts`,
`src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Assemble the two new columns in the client-plane `discountCols`, before
`discountAmount` (offer before settlement); pass a `hasDiscount` flag computed once from the rows to
the header and picker label calls.

**Contract**: `BuildV2ColumnsOptsT` gains `hasDiscount?: boolean`, set from
`hasPlannedDiscount(rows)` in `use-kosztorys-editor.ts`; `columnTitle` and both
`columnLabelForView` calls in `column-selection.ts` forward it. The share/podgląd renders through the
same grid, so it gets the header for free.

#### 2. Investor document disclosure

**File**: `src/lib/kosztorys/client-view/columns.ts`

**Intent**: Offer the new column in „Opcje" under „Ceny i rabat" and give it a document position.

**Contract**: `CLIENT_VIEW_GROUPS` „Ceny i rabat" keys: `'price', 'discountType', 'discountValue',
'plannedDiscountAmount', 'discountAmount'`. `CLIENT_DOCUMENT_COLUMNS`: insert
`'plannedDiscountAmount'` after `'discountType'`. `client-view/settings.ts` is **not** edited — absent
from `DEFAULT_VISIBLE_COLUMNS` = hidden by default; `LEGACY_CLIENT_COLUMNS` stays frozen.

#### 3. PDF offer

**Files**: `src/lib/kosztorys/print/offer-columns.ts`, `src/lib/kosztorys/print/offer.ts`

**Intent**: Print the new column and suffix the value headers under the same rule.

**Contract**: `offerColumnsByKey` gains `plannedDiscountAmount: [money('plannedDiscountAmount',
clientLabel('plannedDiscountAmount'))]`; the `plannedNet` header becomes „Wartość netto — po
rabacie" when the rows have a rabat and `currentPlannedNet` goes through the same suffixed
`columnLabelForView`. `offerPrintColumns` takes `hasDiscount` (computed in `buildOfferPrintHtml` from
`hasPlannedDiscount(rows)`); the empty filter already drops the column via `investorEmptyColumnIds`.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/kosztorys/print/offer.test.ts` — with a rabat and the column shown: the PDF has
  „Rabat kwota netto (przedmiar)" with the row value and „Wartość netto — po rabacie"; without a
  rabat: neither the column nor the suffix; default settings: column absent
- `src/__tests__/lib/kosztorys/client-view/columns.test.ts` / `settings.test.ts` — the new key sits
  in the ceiling, is hidden by default, and an existing stored map without it reads it as hidden
- `src/__tests__/components/kosztorys/editor/grid/` — the editor assembles both new columns on the
  client plane only, the netto/brutto axis selects one of them (`kosztorys-money-axis.test.ts`),
  `preview-columns.test.ts` admits only the netto one, `v2-columns-order.test.ts` updated for the
  new position

#### Manual Verification:

- Editor of a kosztorys with a 5 % rabat on some pozycje: in the column picker tick „Rabat kwota
  netto (przedmiar)" — each rabat row shows przedmiar × cena − wartość przedmiaru netto, the footer
  sum matches; toggle brutto — the brutto twin replaces it; „Wartość przedmiaru netto — po rabacie"
  in the header.
- Same investment, „Opcje" → „Ceny i rabat": the new column is unticked; tick it — the podgląd and
  the share link show it beside „Rabat"; „Drukuj PDF" prints it with „Wartość netto — po rabacie".
- An investment with no rabat anywhere: header has no „— po rabacie"; ticking the new column in
  „Opcje" shows nothing on the podgląd/PDF.
- An investment with a global rabat: the new columns are absent from the editor picker and the
  investor document.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- The value (percent, amount, przedmiar 0, global rabat, crew plane), totals, predicate, label rule,
  disclosure defaults, PDF output — all at the lib layer, the cheapest that holds the risk.

### Integration Tests:

- None — no DB or server-action path changes.

### Manual Testing Steps:

See Phase 2 Manual Verification. E2E disposition (author or file `e2e-backlog`) is decided at the
review gate, per AGENTS.md → Testing.

## Performance Considerations

`hasPlannedDiscount` is one pass over rows per render of the editor, alongside the existing
`investorEmptyColumnIds` pass — negligible at 1000+ rows.

## Migration Notes

None. Stored client-view settings don't mention the new key, so it reads its code default (hidden).

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Touched specs pass: `pnpm exec vitest run <each spec above>` (full suite only when asked)

## References

- Change notes: `context/changes/2026-10-16-offer-planned-discount-amount/change.md`
- Prior label decision: commit b921b9476
- Disclosure defaults: `context/foundation/lessons.md` → „Stored preferences record the deviation;
  disclosure settings fail closed"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Value, predicate and label rule (lib, test-first)

#### Automated

- [ ] 1.1 kosztorys-calc.test.ts — rowPlannedDiscountForView cases
- [ ] 1.2 column-values.test.ts / column-totals.test.ts — new values and footer totals
- [ ] 1.3 settlement-columns.test.ts — hasPlannedDiscount and the empty-column rule
- [ ] 1.4 columnLabelForView spec — conditional „— po rabacie" and global-rabat bypass

### Phase 2: Wire the editor, the investor document and the PDF

#### Automated

- [ ] 2.1 offer.test.ts — PDF column and suffixed header, with and without rabat
- [ ] 2.2 client-view columns/settings specs — ceiling, hidden by default, stored map without the key
- [ ] 2.3 editor grid specs — assembly, money axis, preview admission, column order
