# Brutto Columns on the Investor's Document — Implementation Plan

## Overview

Let the owner opt brutto columns into the investor's document (preview `/podglad-inwestora/[id]` and
share link `/k/[token]`), off by default. The settings dialog gets a „Kwoty: Netto / Brutto" pair that
bulk-toggles each money family over the existing hidden-column map; the brutto checkboxes render only
while „Brutto" is on. The PDF stays netto.

## Current State Analysis

- The owner removed every brutto column from the investor's document on 2026-09-28 (`7a986a1b6`,
  guard `942e3cfe4`); `kosztorys-editor-domain-notes.md:387` records it. Owner reversed it on
  2026-10-22 as an opt-in (decisions in `research.md` → „Owner decisions").
- Gross columns are separate keys with labels (`column-config.ts:17-60`), money-family tags
  (`COLUMN_MONEY_AXIS`, `column-config.ts:139-158`, `price` tagged `net`), values
  (`columns/column-values.ts:83-96`) and totals. The preview grid assembles them already; only
  `PREVIEW_VISIBLE_COLUMNS` keeps them off.
- Settings store a full `{key: hidden}` map; a key absent from it reads as its code default
  (`client-view/settings.ts:37-64`, `columns/document-column-visibility.ts`). Gross keys outside
  `DEFAULT_VISIBLE_COLUMNS` therefore start hidden everywhere — no migration.

## Desired End State

- An investment whose owner never touched the new control shows exactly the document it shows today.
- In „Ustawienia podglądu inwestora", ticking „Brutto" reveals the brutto twin of every netto column
  currently shown and the „Kwoty brutto" group of checkboxes; unticking hides every brutto column and
  the group. „Netto" works the same way on the netto family, `Cena j.m.` included. Saved per
  investment and via „Zapisz jako domyślne".
- Preview and share link render the ticked brutto columns, hidden like their netto twins until the
  first etap entry. The PDF prints no brutto column.

### Key Discoveries:

- `COLUMN_MONEY_AXIS` already classifies every document money column, `price` as `net`; the editor's
  `price` exemption is a separate set (`AXIS_EXEMPT_COLUMNS`, `column-config.ts:183`) and must not be
  used here.
- `offerPrintColumns` drops a key with no print mapping (`print/offer-columns.ts:93`, `byKey[key] ?? []`),
  and the portrait/landscape switch counts print columns, not keys (`print/offer.ts:41-77`) — a ticked
  brutto column cannot flip the PDF's orientation.
- `ColumnOrderDialog` computes ranks from its items' order plus `baseRanks`
  (`ui/column-order-dialog.tsx:50-62`, `lib/table/column-order.ts:31-46`); a filtered item list is safe
  only while `baseRanks` stays built over the full `CLIENT_DOCUMENT_COLUMNS`.
- Pair-checkbox logic is React-free: `derivePairChecks` / `togglePairAxis` (`lib/kosztorys/axis-checkboxes.ts`).
- Existing DOM spec for the dialog: `src/__tests__/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog.test.tsx`.

## What We're NOT Doing

- No brutto on the PDF — no print entries, no „Razem brutto" / VAT in the footer box.
- No stored money-axis field, no change to the disclosure predicate or the server sanitizer's shape.
- No default keyed on `settlementMode` — the 2026-08-12 ruling stands.
- No change to the worker's document (its own catalogue stays brutto-free) or to the editor's own
  „Kolumny" menu.
- No translation of the gross labels — the investor's document is Polish.

## Implementation Approach

The hidden map stays the single source of truth. Phase 1 widens the allowlist and adds one pure
module that derives the pair's checks from a settings value and applies a family toggle; Phase 2 is
UI over that module. The UI lands first, for review, and the specs follow once it is accepted.

## Critical Implementation Details

- **Toggling a family with nothing to mirror.** Turning a family on mirrors the twins of the other
  family's visible columns; when none is visible (e.g. „Brutto" on while „Netto" is off), it reveals
  the twins of the netto columns in `DEFAULT_VISIBLE_COLUMNS` instead — otherwise the click changes
  nothing and the checkbox stays unticked.
- **Order dialog filter.** Filter only the rendered items; `documentBaseRanks` and `orderDocumentKeys`
  keep running over the full `CLIENT_DOCUMENT_COLUMNS`, or every drag lands against the wrong
  neighbours.

## Phase 1: Working Dialog for UI Review

### Overview

The owner can see and click the whole feature: the „Kwoty" pair, the conditional brutto group, the
order-dialog filter, and the brutto columns rendering in the preview. No specs in this phase — the
UI shape is still open. Before the first etap entry, brutto columns may still show where netto ones
hide; Phase 2 closes that.

### Changes Required:

#### 1. Allowlist and document order

**File**: `src/lib/kosztorys/client-view/columns.ts`

**Intent**: Add the gross keys as a new last group „Kwoty brutto" of `CLIENT_VIEW_GROUPS`, so they
enter `PREVIEW_VISIBLE_COLUMNS`; slot each into `CLIENT_DOCUMENT_COLUMNS` right after its netto twin.
Export the twin map and the gross group's keys for the dialog.

**Contract**: `CLIENT_GROSS_TWINS: Readonly<Record<string, string>>` — netto key → brutto key, exactly
`price→priceGross`, `plannedDiscountAmount→plannedDiscountAmountGross`,
`discountAmount→discountAmountGross`, `plannedNet→plannedGross`, `currentPlannedNet→currentPlannedGross`,
`net→gross`, `remaining→remainingGross`, `STAGE_VALUE_NET_COLUMN_GROUP→STAGE_VALUE_GROSS_COLUMN_GROUP`.
`DEFAULT_VISIBLE_COLUMNS` (`settings.ts`) stays unchanged — that is what keeps brutto off by default.

#### 2. Money-family logic

**File**: `src/lib/kosztorys/client-view/money-family.ts` (new)

**Intent**: Derive the „Netto"/„Brutto" checks from a settings value (a family is on iff any of its
document columns is visible), and apply a family toggle to `hiddenColumns`: off hides the whole family;
on unhides the twins of the other family's visible columns, falling back to the twins of the default
netto set (see Critical Implementation Details). Family membership = `COLUMN_MONEY_AXIS` over
`PREVIEW_VISIBLE_COLUMNS`.

**Contract**: `moneyFamilyChecks(value: { hiddenColumns: string[] }): { net: boolean; gross: boolean }`,
`toggleMoneyFamily<T extends { hiddenColumns: string[] }>(value: T, family: 'net' | 'gross'): T` —
preserves every other field of `T`. Non-money columns (`discountType`, `discountValue`, quantities,
`%`) are never touched.

#### 3. Pair section in the form

**File**: `src/components/kosztorys/editor/dialogs/view-settings/client-view-settings-form.tsx`

**Intent**: Above the column groups, render a „Kwoty" `FieldSet` with two `CheckboxRow`s („Netto",
„Brutto") driven by `moneyFamilyChecks` / `toggleMoneyFamily`, with a one-line hint that unticked
single columns stay hidden. Pass `ViewSettingsFields` the groups without „Kwoty brutto" while brutto
is off. Rewrite the existing hint so it no longer names „razem netto" only.

**Contract**: `ViewSettingsFields` and the worker dialog unchanged. Compose `ui/` primitives
(`FieldSet`, `FieldLegend` with `GROUP_LEGEND_CLASS`, `CheckboxRow`) — no new `ui/` component.

#### 4. Order dialog filter

**File**: `src/components/kosztorys/editor/dialogs/view-settings/document-column-order-button.tsx`

**Intent**: Let the caller omit keys from the rendered list (the brutto keys while brutto is off) while
ranks keep being computed over the full key list.

**Contract**: optional prop, e.g. `isListed?: (key: string) => boolean`; `baseRanks` /
`orderDocumentKeys` / reset comparison still use `keys`.

### Success Criteria:

#### Manual Verification (the user reviews the UI here):

- Locally (dev DB, owner login), open the kosztorys of an investment with etap entries → „Ustawienia podglądu inwestora": „Netto" ticked, „Brutto" unticked, no brutto checkboxes; tick „Brutto" → group appears with twins of the shown netto columns ticked; save; preview shows them beside their netto twins.
- Untick „Netto" → save → preview shows only brutto money columns (no „Cena j.m."), descriptions and quantities intact.
- „Ustaw kolejność kolumn…" lists brutto rows only while „Brutto" is ticked.

**Implementation Note**: Stop after this phase and hand the UI to the user. Iterate on its feedback
without specs, typecheck or lint; start Phase 2 only once the user accepts the UI, and commit the
accepted UI first.

---

## Phase 2: Hardening — Empty Columns, Print Exemption, Specs, Docs

### Overview

Pin what Phase 1 built and close its gaps: brutto columns hide while unsettled, never print, every
existing investment's document is guarded, and the domain notes carry the new ruling.

### Changes Required:

#### 1. Empty-settlement twins

**File**: `src/lib/kosztorys/settlement-columns.ts`

**Intent**: Hide the brutto twins exactly when their netto columns are hidden before the first etap
entry — `gross`, `discountAmountGross` in the settlement totals; `remainingGross`,
`currentPlannedGross` in the offer-phase set; `stageValueGross_<id>` per empty etap;
`plannedDiscountAmountGross` beside `plannedDiscountAmount` when there's no planned rabat.

**Contract**: `emptySettlementColumnIds` / `investorEmptyColumnIds` return sets widened by those ids
(both feed the worker surface too — the worker's catalogue has no gross key, so extra ids are inert there).

#### 2. Specs

**Files**:

- `src/__tests__/lib/kosztorys/client-view/money-family.test.ts` (new) — checks derivation; off hides the family only; on mirrors the visible twins; on with nothing to mirror falls back to the default set; `price`↔`priceGross` paired; non-money columns untouched.
- `src/__tests__/lib/kosztorys/client-view/settings.test.ts` — regression guard: default settings, a stored map written before this change (no gross keys) and a legacy array all resolve with every gross key hidden.
- `src/__tests__/lib/kosztorys/settlement-columns.test.ts` — gross twins in the empty sets.
- `src/__tests__/lib/kosztorys/print/offer.test.ts` — the „every document key has a print column" case iterates netto keys only, and a new case pins that ticked brutto keys produce no print column.
- `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts` — replace „carries no brutto column" with „brutto stays off the document until ticked" (rendered ids with the default hidden set vs. a set that unhides them); update the przedmiar order case for `priceGross` / `plannedGross` / `currentPlannedGross` beside their twins.
- `src/__tests__/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog.test.tsx` — default settings render „Netto" ticked, „Brutto" unticked, no brutto checkbox; ticking „Brutto" shows the group with the twins of the visible netto columns ticked and saves a map with those keys `false`; unticking „Netto" saves every netto money key `true`, `price` included.

#### 3. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Replace the 2026-09-28 bullet at `:387` with the 2026-10-22 ruling (brutto opt-in, off by
default, PDF netto only, `Cena j.m.` paired with its brutto twin); sweep the nearby disclosure
passages (`:340-368`) for a claim that brutto can't be ticked.

### Success Criteria:

#### Automated Verification:

- Money-family spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view/money-family.test.ts`
- Client-view specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view`
- Settlement-columns spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-columns.test.ts`
- Offer print spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/offer.test.ts`
- Preview-columns spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`
- Dialog spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog.test.tsx`

#### Manual Verification:

- An investment the owner never touched shows the same preview as before — no brutto column.
- On an investment with no etap entries, ticked „Wartość brutto (razem etapy)" / „Pozostało brutto" stay hidden like their netto twins.
- PDF („Drukuj ofertę") of an investment with brutto ticked prints no brutto column and the same orientation as before.
- Dragging a netto column with brutto off still lands where dropped once brutto is turned on.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Family derivation and toggling, the empty-mirror fallback, `price` pairing — the pure module.
- Defaults/legacy maps keep brutto hidden — the regression guard for every existing investment.
- Empty-settlement twins and the PDF exemption.

### Integration Tests:

- None needed: the server action and query run the same `sanitizeClientViewSettings`, whose ceiling is
  `PREVIEW_VISIBLE_COLUMNS`; `kosztorys-client-view.db.test.ts` compares against code defaults.

### Manual Testing Steps:

As listed under each phase's Manual Verification.

## Migration Notes

None. Stored maps hold no gross key, so every one resolves gross to the code default (hidden).

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Research and owner decisions: `context/changes/2026-10-22-investor-gross-columns/research.md`
- The ruling being reversed: `7a986a1b6`, `942e3cfe4`
- Pair-checkbox precedent: `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:34-65`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Working Dialog for UI Review

#### Automated

- [ ] 1.1 No automated check — UI review phase; accepted UI committed

### Phase 2: Hardening — Empty Columns, Print Exemption, Specs, Docs

#### Automated

- [ ] 2.1 Money-family spec passes
- [ ] 2.2 Client-view specs pass
- [ ] 2.3 Settlement-columns spec passes
- [ ] 2.4 Offer print spec passes
- [ ] 2.5 Preview-columns spec passes
- [ ] 2.6 Dialog spec passes
