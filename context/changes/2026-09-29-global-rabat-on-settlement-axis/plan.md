# Rabat kwotowy — linked netto/brutto fields Implementation Plan

## Overview

Today the rabat kwotowy on the whole kosztorys can be typed only in netto: 5000 typed on a brutto
job takes 5400 off the brutto bill (inv. 112). The fix replaces the single „zł" field with two linked
inputs, netto and brutto. The owner types into either one and the other shows its counterpart live;
one „Zapisz" commits. Storage stays one netto figure, so every reader is unchanged.

## Current State Analysis

- `GlobalDiscountControl` (`src/components/kosztorys/summary/settings/global-discount-control.tsx:76-86`)
  renders one `DiscountValueField` for the kwota. Its hint (`:26`) says „Kwota netto…". The control
  has no VAT rate. `SummaryInvestmentSettings` holds `vatRate` (`summary-investment-settings.tsx:13,39`)
  and renders the control at `:91` without it.
- `handleGlobalDiscountChange` (`src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:255-265`)
  rounds to cents before the no-op check and the save. A netto derived from a brutto entry
  (5000 / 1,08 = 4629,6296…) would be cut to 4629,63, which re-grosses to 5000,0004. That is fine at
  8%, but at 23% the error can reach a grosz.
- Storage is `investments.global_discount_value numeric`, which is precision-agnostic. The action
  schema (`src/lib/actions/kosztorys.ts:78-84`) is `z.coerce.number().min(0)` and needs no change.
- Every reader (Podsumowanie, listing, marża, reconciliation, protokół, offer, sheet compare) takes
  the stored netto. The grossing surfaces use `toGross(netto, vat)`, so a netto of `toNet(typed)`
  re-derives the typed brutto.
- „Historia zmian" (`src/lib/kosztorys/history/change-rows.ts:29-30,92-98`) prints the raw netto.
  Each side of the diff is a `HistoryVersionT = { tree, discount }` (`history/types.ts:9`), so each
  version's `tree.vatRate` is available to `diffDiscount` (`history/diff-versions.ts:84-89`).

## Desired End State

On inv. 112 (brutto, 8%) the owner picks „Kwotowy" and types 5000 into „brutto". The „netto" input
shows 4629,63 while typing. „Zapisz" persists 4629.62963 (6 dp). The Podsumowanie brutto column shows
Rabat −5000,00, and Łącznie and Pozostało do zapłaty drop by exactly 5000,00 against no rabat.
Typing into „netto" behaves as it does today. „Historia zmian" shows a rabat change as
„4 629,63 netto / 5 000,00 brutto". Undo/redo, mode switching and the seeded Σ-rabatów start value
all keep working.

### Key Discoveries:

- `round6` already exists (`src/lib/utils/round.ts`), used for coefficients. It is the storage
  precision here too, and still strips the float residue behind „172024,28000000003".
- `toGross` / `toNet` (`src/lib/kosztorys/calc.ts:205-215`) are the only crossing pair. Use them,
  not hand-written `× 1.08`.
- `DiscountValueField`'s resync pattern (`seenValue` vs `value`, `discount-value-field.tsx:59-63`)
  is how the field follows undo / rollback / mode reseed. The new pair needs the same pattern, and
  must also resync on a VAT change.
- The deposit form's netto/brutto pair (`netFromGross`, `net-suggestion.ts`) stores both kwoty
  independently. It is a different contract (overwritable suggestion), so it is not reused here.

## What We're NOT Doing

- The per-pozycja rabat kwota (grid cell, `calc.ts:58-66`). It has the same symptom but 0 rows in
  prod. It stays netto.
- The grossing rule, `settlement-summary.tsx`, `summary-economics.ts`, the listing SQL,
  reconciliation, the protokół, the offer PDF. All unchanged by design.
- Any data fix for inv. 112. After deploy, the owner re-types 5000 in „brutto".
- An axis column or axis tag on the stored kwota.
- Unrelated doc drift from the research: the AGENTS.md 403 on the canonical sheet, the EX-495
  attribution in `calc.ts:243`, and the settlement-mode comments.

## Implementation Approach

The whole change sits on the input side of one stored number, in three steps:

1. Storage precision: round to 6 dp instead of cents.
2. A linked-pair input that converts at commit time.
3. The history row renders the pair at each version's own VAT.

The docs are updated so the "entered netto" assumption stops being stated as a rule.

## Critical Implementation Details

**Precision, one rounding:** `handleGlobalDiscountChange` switches `roundToCents` → `round6`, and
the no-op check keeps comparing the rounded value. The seeded Σ rabatów also goes through `round6`,
which still cleans its float residue. Displays keep `roundToCents` / `formatPLN`.

**Commit converts once:** the pair commits the netto, which is `toNet(brutto, vat)` when „brutto" was
the last-edited input. Never derive brutto → netto → brutto through a cent-rounded intermediate.

**VAT 0%:** netto and brutto are equal, so both inputs mirror each other. This is not a special case.

## Phase 1: Storage precision

### Overview

Stop cutting the stored kwota to cents so a brutto-derived netto round-trips exactly.

### Changes Required:

#### 1. Global discount write

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts`

**Intent**: Quantize the incoming kwota with `round6` instead of `roundToCents`. Update the comment
to explain why sub-grosz netto is intended: a brutto entry's netto must re-gross to the typed figure.

**Contract**: `handleGlobalDiscountChange(next: GlobalDiscountT)` — the persisted `value` is
`round6(next.value)`. The no-op check compares that same value.

#### 2. Round-trip guard

**File**: `src/__tests__/lib/kosztorys/global-discount-round-trip.test.ts` (new)

**Intent**: Pin the invariant the whole change rests on. For brutto kwoty typed in grosze
(e.g. 5000, 0,01, 1234,57, 99 999,99) at VAT 0 / 5 / 8 / 23%,
`roundToCents(toGross(round6(toNet(b, vat)), vat)) === b`.

**Contract**: pure unit spec over `toGross`, `toNet`, `round6`, `roundToCents`.

### Success Criteria:

#### Automated Verification:

- Round-trip spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/global-discount-round-trip.test.ts`
- Settings hook spec still passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-settings.test.tsx`

#### Manual Verification:

- (covered in Phase 2)

---

## Phase 2: Linked netto/brutto inputs

### Overview

Replace the kwota's single field with two linked inputs and one „Zapisz".

### Changes Required:

#### 1. Linked pair component

**File**: `src/components/kosztorys/summary/settings/discount-amount-pair-field.tsx` (new)

**Intent**: Two `DecimalInput`s labelled „netto" and „brutto" (suffix „zł") and one „Zapisz". The
owner types into either one. The other input shows the counterpart live: `toGross` / `toNet` at the
investment's VAT, formatted to grosze. The component remembers which input was edited last.
„Zapisz" or Enter commits the netto: the typed netto, or `toNet(typed brutto)` at full precision.
Commit happens only through Zapisz/Enter, never on blur (the same rule as `DiscountValueField`).
Zapisz stays inert until something changed and the value is valid (≥ 0). An invalid or half-typed
entry (`''`, `'-'`) leaves the other input empty, never NaN.

**Contract**: `PropsT = { value: number /* stored netto */; vatRate: number; disabled?: boolean; onApply: (net: number) => void }`.
Resync both inputs from `value` whenever `value` or `vatRate` changes, using the same
render-time `seenValue` pattern as `DiscountValueField`, not `useEffect`. That covers undo, rollback,
mode reseed and a VAT change. The displayed stored pair is `roundToCents(value)` /
`roundToCents(toGross(value, vatRate))`.

#### 2. Control wiring and hint

**File**: `src/components/kosztorys/summary/settings/global-discount-control.tsx`

**Intent**: Render the pair field for „Kwotowy" in place of the single `DiscountValueField`. Accept
`vatRate` as a prop. Rewrite the „Kwotowy" hint so it no longer says „netto". It should say that the
kwota can be typed in netto or brutto, the other is computed at the investment's VAT, and it replaces
per-pozycja rabaty and never reaches subcontractor prices. The `%` mode is untouched.

**Contract**: `GlobalDiscountControl({ disabled, vatRate })`.

**File**: `src/components/kosztorys/summary/settings/summary-investment-settings.tsx`

**Intent**: Pass `vatRate` to `GlobalDiscountControl`.

#### 3. DOM spec

**File**: `src/__tests__/components/kosztorys/summary/settings/discount-amount-pair-field.test.tsx` (new)

**Intent**: Pin the owner-visible behaviour at VAT 8%:
- Typing 5000 into „brutto" shows 4629,63 in „netto" before saving. Zapisz calls `onApply` with
  `toNet(5000, 0.08)`.
- Typing into „netto" shows the brutto live and commits the typed netto.
- Enter commits, blur does not.
- Zapisz is disabled when nothing changed.
- A new `value` or `vatRate` prop resyncs both inputs.

**Contract**: `render` + `userEvent`, following `materials-net-pricing-control.test.tsx`.

### Success Criteria:

#### Automated Verification:

- Pair-field spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/settings/discount-amount-pair-field.test.tsx`

#### Manual Verification:

- Inv. 112 (Szeligowska 57b/7, brutto, 8%) → Podsumowanie → ustawienia → Rabat „Kwotowy":
  - Typing 5000 in „brutto" shows 4629,63 in „netto" before saving.
  - After Zapisz, the brutto column shows Rabat −5000,00.
- Same investment, Pozostało do zapłaty brutto: it is exactly 5000,00 lower than with the rabat
  „Wyłączony".
- A netto investment (e.g. inv. 106):
  - The stored kwota shows unchanged in „netto" (2419,00).
  - „brutto" shows it at the investment's VAT.
  - The Podsumowanie is unchanged.
- Ctrl+Z after saving a kwota brings both inputs back to the previous kwota.
- Changing the VAT stawka with a kwota saved: „brutto" follows the new rate and „netto" stays.
- Switching „Wyłączony" → „Kwotowy": the inputs start at the sum of the per-pozycja rabaty.

---

## Phase 3: „Historia zmian" shows the pair

### Overview

A rabat change in version history reads in both axes, so the owner recognises the figure they typed.

### Changes Required:

#### 1. Diff carries each side's VAT

**File**: `src/lib/kosztorys/history/diff-versions.ts`, `src/lib/kosztorys/history/types.ts`

**Intent**: `diffDiscount` attaches each version's `tree.vatRate` to its `before` / `after`, so the
brutto is shown at the VAT in force in that version, not today's. Equality stays on type + value.

**Contract**: The `DiscountChangeT` `changed` variant's `before` / `after` gain `vatRate: number`.

#### 2. Row text

**File**: `src/lib/kosztorys/history/change-rows.ts`

**Intent**: `discountText` renders an amount rabat as „<netto> netto / <brutto> brutto" with
`formatPLN`. No rabat still reads „brutto" → „brak".

**Contract**: `versionChangeRows(diff)` row `what: 'Rabat'` — the before/after text only.

#### 3. Specs

**File**: `src/__tests__/lib/kosztorys/history/change-rows.test.ts`, `src/__tests__/lib/kosztorys/history/diff-versions.test.ts`

**Intent**: Update the rabat row expectation to the pair. Add a case where the two versions carry
different VAT rates, and each side is grossed at its own.

### Success Criteria:

#### Automated Verification:

- History specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/history/`

#### Manual Verification:

- Inv. 112 → Historia zmian → the entry after saving 5000 brutto shows the Rabat row as
  „… netto / 5 000,00 brutto".

---

## Phase 4: Docs

### Overview

Stop the docs stating "entered netto" as a rule, and close the stale open question.

### Changes Required:

#### 1. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**:
- In the rabat/VAT section (~`:650-659`, `:684-686`, `:712-718`, `:725-747`), record the owner's
  rule: the rabat kwotowy is typed on either axis, stored as netto, and grossed like prace.
- Correct the `:656` evidence line: column R is a percent, which says nothing about a kwota's axis.

**Contract**: prose only, Polish per that file's register.

#### 2. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Mark the netto/brutto rabat question at `:461-466` resolved by this change.

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- None (prose-only phase).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- Round-trip invariant across VAT rates and grosz-edge kwoty (Phase 1).
- History diff/row text with the pair and a per-version VAT (Phase 3).

### Component Tests:

- Linked pair: live counterpart, commit axis, Enter vs blur, inert Zapisz, resync on value/VAT (Phase 2).

### Manual Testing Steps:

See the Phase 2 and Phase 3 manual bullets. Run them on the local DB (a prod dump with inv. 112 and 106).

## Migration Notes

No schema or data migration. Existing stored kwoty are netto and keep meaning netto. Inv. 112's
stored 5000 stays until the owner re-types 5000 in „brutto" after deploy. Tell the owner.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

(Full suite runs in the pre-push hook; not run by the agent unasked.)

## References

- Research: `context/changes/2026-09-29-global-rabat-on-settlement-axis/research.md`
- Linear: EX-933
- Resync pattern: `src/components/kosztorys/summary/settings/discount-value-field.tsx:59-63`
- DOM spec pattern: `src/__tests__/components/kosztorys/summary/settings/materials-net-pricing-control.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage precision

#### Automated

- [x] 1.1 Round-trip spec passes — 4b0cf124
- [x] 1.2 Settings hook spec still passes — 4b0cf124

### Phase 2: Linked netto/brutto inputs

#### Automated

- [x] 2.1 Pair-field spec passes — 05f80d58

### Phase 3: „Historia zmian" shows the pair

#### Automated

- [x] 3.1 History specs pass

### Phase 4: Docs

#### Automated

- [ ] 4.1 None (prose-only phase)
