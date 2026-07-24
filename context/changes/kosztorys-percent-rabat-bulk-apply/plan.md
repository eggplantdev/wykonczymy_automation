# Percent Global Rabat → Bulk-Apply Implementation Plan

## Overview

Owner decision: the percent-mode global rabat stops being stored state that overrides per-item
rabaty. Instead it becomes a one-shot tool: entering X% and clicking „Zastosuj" writes
`discountType='percent', discountValue=X` into **every** item row (overwriting whatever was there),
after which rows are edited normally. Amount-mode global rabat keeps today's semantics exactly
(stored on the investment, hides per-item rabat columns, subtracted once at the total). Snapshots
stop carrying global-discount settings — rabat is per-investment and never travels via version
restore or presets.

## Current State Analysis

- `GlobalDiscountT = { type: 'percent' | 'amount' | null, value }` stored on the investment
  (`src/collections/investments.ts:110-119`), read into the tree
  (`src/lib/queries/kosztorys.ts:148-151`), saved via `updateInvestmentGlobalDiscountAction`
  (`src/lib/actions/kosztorys.ts:137-154`).
- When active (either mode), `applyDiscount` short-circuits per-item rabat
  (`src/lib/kosztorys/calc.ts:26-33`), rabat columns are hidden
  (`kosztorys-v2-columns.tsx:455,506` via `DISCOUNT_COLUMN_IDS`), and
  `globalDiscountAmount` subtracts once at the total (`calc.ts:169-173`).
- The editor mirrors it in local state and patches `globalDiscountActive` onto all rows on change,
  with optimistic save + rollback (`use-kosztorys-editor.ts:121-122, 918-943`).
- Snapshots persist `globalDiscountType/Value` (`snapshot-format.ts:32-33`,
  `serialize-kosztorys.ts:24-25`, `restore-kosztorys.ts:36-38`).
- Presets already zero per-item rabat and never carried global discount — no change needed there.
- Per-item rabat edits go through `updateItemFieldAction` (single-item patch); a kosztorys can hold
  1000+ items, so the bulk write needs its own action, not N calls.

## Desired End State

- Global settings shows: amount-mode select/value as today, plus a percent input + „Zastosuj"
  button. Clicking it overwrites every item's rabat with `percent X`, the input resets to empty,
  and the grid reflects the new rabaty immediately. No percent value is stored anywhere.
- Stored global discount is amount-or-null; `'percent'` is no longer a valid stored type.
- Version restore never touches rabat settings; restoring an old snapshot keeps the investment's
  current amount-mode discount as-is (snapshot rows still carry their per-item rabaty).

### Key Discoveries:

- `handleGlobalDiscountChange` (`use-kosztorys-editor.ts:918-943`) is the pattern for
  "mutate all rows optimistically + persist + rollback" — the bulk-apply handler mirrors it.
- Payload Local API has no bulk update-with-where that maps to one SQL statement efficiently at
  this scale; financial bulk writes in this repo use raw SQL via `@vercel/postgres`
  (`src/lib/db`) — the bulk action should follow that route and then revalidate
  `kosztorysItems`.
- `isGlobalDiscountActive` (`calc.ts:21`) fails closed on unknown types, so narrowing the stored
  type union is safe against any stray `'percent'` rows left in dev DBs (they'd just go inactive).
  Kosztorys data is throwaway — no migration/backfill owed; a cleanup `UPDATE investments SET
global_discount_type = NULL WHERE global_discount_type = 'percent'` in the migration is optional
  polish, not a requirement.

## What We're NOT Doing

- No confirmation dialog and no dedicated undo-stack entry for the bulk-apply (owner accepts the
  overwrite; recovery = re-typing).
- No change to amount-mode semantics, column hiding, or reconciliation shape
  (`rabatClientNet = globalDiscountAmount + Σ item rabat` still holds; percent now flows through
  the Σ term).
- No preset changes (already rabat-free).
- No data-preservation path for existing percent-mode rows (kosztorys data is throwaway until
  dogfooding merges).
- Not touching the RABAT transaction plane or the recon seam.

## Implementation Approach

Two phases. Phase 1 adds the new capability (bulk action + UI) while percent is still a legal
stored value — the feature is usable end-to-end after phase 1. Phase 2 narrows the stored model to
amount-only and strips percent + snapshot fields, updating tests. This ordering keeps every commit
green: the UI stops offering percent-as-state in phase 1, so phase 2's narrowing breaks nothing.

## Phase 1: Bulk-apply action + settings UI

### Overview

A server action that stamps `percent X` on all of an investment's items in one SQL statement, and
the settings control that triggers it: percent input + „Zastosuj", one-shot, resets after apply,
optimistic grid update.

### Changes Required:

#### 1. Bulk server action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: New `applyPercentRabatToAllItemsAction(investmentId, percent)` — validates
`percent` (0–100), single SQL `UPDATE` setting `discount_type='percent', discount_value=$percent`
for all items belonging to the investment's kosztorys, wrapped in `protectedAction()`, then
revalidates the kosztorys tags.

**Contract**: `(investmentId: number, percent: number) => ActionResultT`. Raw SQL via the
`src/lib/db` client (1000+ rows; the Payload ORM would issue N updates). Zod: positive number
≤ 100; reject 0 (a 0% "apply" is a mass rabat-clear — if the owner wants clearing, that's a
separate explicit feature, not a silent side effect).

#### 2. Settings UI — percent becomes a tool, amount stays a field

**File**: `src/components/kosztorys/kosztorys-global-settings.tsx`

**Intent**: Replace the type-select's percent branch with a standalone „Rabat % na wszystkie
pozycje" row: numeric input + „Zastosuj" button (disabled while empty/invalid/pending). On success
the input clears. The amount-mode select/value keeps working exactly as today (its select loses the
percent option).

**Contract**: New prop `onApplyPercentRabat(percent: number): Promise<boolean>` (resolves success),
threaded from the editor context via `kosztorys-editor-toolbar.tsx`.

#### 3. Editor handler — optimistic bulk patch

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: `handleApplyPercentRabat(percent)`: optimistically set
`discountType: 'percent', discountValue: percent` on every item row in local state (mirror the
all-rows patch in `handleGlobalDiscountChange`), call the bulk action, roll back the previous
per-row rabat values on failure.

**Contract**: Exposed through the editor context object alongside `handleGlobalDiscountChange`.
Totals/subtotals recompute from row state automatically — no extra wiring.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm exec tsc --noEmit`
- Unit test: bulk action schema rejects 0, negatives, >100 (`pnpm exec vitest run src/__tests__/...`)
- Existing kosztorys unit suites still green

#### Manual Verification:

- On a seeded kosztorys (INV=6): enter 10%, „Zastosuj" → every row shows rabat 10%, totals drop
  accordingly, input clears; reload → rabaty persisted on rows
- A row's rabat edited afterwards recomputes totals; re-applying 15% overwrites it
- Amount-mode global rabat still works and still hides rabat columns

**Implementation Note**: Pause after this phase for manual confirmation before Phase 2.

---

## Phase 2: Amount-only stored discount + snapshot cleanup

### Overview

Narrow the stored global discount to amount mode and remove global-discount settings from the
snapshot format.

### Changes Required:

#### 1. Type + schema narrowing

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/actions/kosztorys.ts`,
`src/collections/investments.ts`

**Intent**: Stored global discount type becomes `'amount' | null`
(`investmentGlobalDiscountSchema`, the collection field's select options, and `GlobalDiscountT`'s
stored flavor). `applyDiscount`'s short-circuit and `globalDiscountAmount` keep their logic;
`globalDiscountAmount`'s percent branch goes away.

**Contract**: `GlobalDiscountT = { type: 'amount' | null; value: number }`. Per-item
`DiscountTypeT` keeps `'percent' | 'amount'` — the narrowing applies ONLY to the stored global
discount. Follow the typecheck to every consumer.

#### 2. Snapshot format drop

**Files**: `src/lib/kosztorys/snapshot-format.ts`, `serialize-kosztorys.ts`,
`restore-kosztorys.ts`

**Intent**: Delete `globalDiscountType/Value` from the settings block; serialize stops writing
them; restore stops reading them (old snapshots with the fields still parse — restore just ignores
unknown keys, matching the existing tolerant-restore pattern).

**Contract**: Restore must not reset the investment's live amount discount.

#### 3. Migration (optional cleanup)

**File**: `src/migrations/`

**Intent**: Hand-written migration nulling any `global_discount_type = 'percent'` rows on
investments (dev DBs only; prod has no kosztorys data). Include only if the collection select
change requires a matching DB enum/constraint touch — check the latest migration's pattern.

#### 4. Tests

**Files**: `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts`, `kosztorys-settlement.test.ts`,
`reconciliation.test.ts`, `src/__tests__/db/snapshots.test.ts`

**Intent**: Percent-mode global-discount cases become amount-mode or are deleted; snapshot test
drops the settings fields; add a settlement case proving Σ per-item percent rabaty feed
`rabatClientNet` identically to the old global-percent figure (same investment-page recon result).

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm exec tsc --noEmit`
- Full unit suite green: `pnpm exec vitest run`
- Lint passes

#### Manual Verification:

- Version restore on a kosztorys with an active amount discount keeps the discount
- Settings UI offers only Kwota for the stored discount; percent tool from Phase 1 unaffected

---

## Testing Strategy

### Unit Tests:

- Bulk action input validation (0 / negative / >100 / non-number)
- Settlement: rows all at percent X ⇒ `rabatClientNet` = Σ row discounts; recon matches a RABAT
  transaction of the same value
- Calc: amount-mode short-circuit unchanged; `isGlobalDiscountActive` false for legacy `'percent'`

### Manual Testing Steps:

1. Seeded kosztorys: apply 10% → verify rows, totals, persistence after reload
2. Overwrite check: hand-set one row to 50 zł rabat, apply 15% → row shows 15%
3. Amount mode: set 5000 zł → rabat columns hide, „Do zapłaty" drops by 5000, survives reload
4. Restore an older version → amount discount untouched

## Migration Notes

Kosztorys data is throwaway (AGENTS.md) — no backfill or compat shim. Migration only if the
`investments.global_discount_type` column type/constraint changes; hand-write it (migrate:create
emits phantom drift).

## References

- Shaping conversation: this session (owner decisions relayed by Konrad)
- Prior change: `context/changes/kosztorys-global-discount/`
- Pattern for all-rows optimistic patch: `src/components/kosztorys/use-kosztorys-editor.ts:918-943`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Bulk-apply action + settings UI

#### Automated

- [ ] 1.1 Typecheck passes
- [ ] 1.2 Bulk action schema validation tests
- [ ] 1.3 Existing kosztorys unit suites green

### Phase 2: Amount-only stored discount + snapshot cleanup

#### Automated

- [ ] 2.1 Typecheck passes
- [ ] 2.2 Full unit suite green
- [ ] 2.3 Lint passes
