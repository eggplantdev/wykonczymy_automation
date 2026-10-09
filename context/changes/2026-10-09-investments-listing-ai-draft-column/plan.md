# „Analiza AI” column on the investments listing — Implementation Plan

## Overview

Add a column to `/inwestycje` saying whether an agent draft was ever loaded into the investment's
kosztorys. The fact rides on the per-investment kosztorys aggregate the listing already runs, so it
costs no new query, no new cache entry and no migration.

## Current State Analysis

- The listing loads six cached aggregates in one `Promise.all` (`src/lib/queries/investments.ts:26`).
  One of them, `selectKosztorysClientTotals` (`src/lib/db/kosztorys-client-totals.ts:35`), already
  folds `kosztorys_items` per investment and returns one row per investment that has items.
- „Is this an AI kosztorys” already has a single definition: `hasAiDraft(rows)` =
  some row has `aiPlannedQty !== null` (`src/lib/kosztorys/review-status.ts:12`). The editor uses it
  to decide whether the AI review columns exist (`use-kosztorys-editor.ts:211`).
- `ai_planned_qty` is written only by the draft loader (`src/scripts/load-ai-draft.ts`; the field has
  `access: { create/update: () => false }`). Every other path that builds an item — preset
  serialization, sheet import, worker-report accept, katalog — writes `null`
  (`serialize-preset.ts:37`, `parse-labor-tab.ts:197`, `accept-worker-report.ts:411`,
  `item-to-catalogue.ts:33`). The sheet re-import keeps the current value (`build-import-plan.ts:240`).
  So a non-null value means a draft was loaded, and nothing else produces one.
- `shapeInvestments` already derives a non-financial fact from the same map: `hasKosztorys` =
  presence of the entry (`src/lib/queries/shape-investments.ts:114`).

## Desired End State

A management user opens `/inwestycje` and sees an „Analiza AI” column: „Tak” for every investment
with a loaded agent draft, „—” for every other one (including investments with no kosztorys at all).
The column sorts, can be hidden in the column picker like any other, and agrees with the editor:
an investment shows „Tak” exactly when its editor shows the AI przedmiar column.

### Key Discoveries:

- The flag has to be the SQL twin of `hasAiDraft`, i.e. `bool_or(ai_planned_qty IS NOT NULL)`. The
  text fields `ai_missing_data` / `ai_assumptions` stay out: counting them would be a second
  definition that could disagree with the editor.
- `KosztorysClientTotalsMapT` is `Record<string, KosztorysClientTotalsT>` (`src/lib/queries/balances.ts:59`)
  and ~30 calls in `shape-investments.test.ts` hand-build that map. A required field on
  `KosztorysClientTotalsT` would break all of them and pollute a financial type that the parity
  spec pins. The flag goes on the row/map type instead, optional on the map.
- `cachedInvestmentMap` keys by a versioned string (`'kosztorys-client-totals-v1'`, `balances.ts:105`;
  compare `'deposit-plane-sums-v3'`). A cached entry written before the deploy lacks the field and
  would read as „—” everywhere until something expires the tag, so the key bumps to `-v2`.
- An absent column-visibility entry means visible (`investment-data-table.tsx:67`), so the new
  column shows by default with no wiring.

## What We're NOT Doing

- No „who created the investment” column. That data does not exist (no `createdBy`, no versions).
- No count of AI rows and no review progress. A flag was chosen. Review progress would need a SQL copy of
  `effectiveReviewStatus`.
- No new query and no new cache tag. `KOSZTORYS_CLIENT_TOTALS_TAGS` already includes `kosztorysItems`,
  so loading a draft expires the entry.
- No removal tracking. The column is permanent (owner decision, 2026-10-09).
- No change to the golden master: `financial-golden-master-db.test.ts` builds its snapshot from named
  fields, so an extra field on the aggregate row does not reach `financial-golden-master.json`.

## Implementation Approach

Extend the existing aggregate by one boolean, carry it through the row type, read it in
`shapeInvestments` beside `hasKosztorys`, and render it as a plain column. Two phases: data first
(with its specs), then the column.

## Phase 1: Flag in the aggregate and the listing row

### Overview

`selectKosztorysClientTotals` returns `hasAiDraft` per investment; `shapeInvestments` puts it on
`InvestmentRowT`.

### Changes Required:

#### 1. Aggregate SQL

**File**: `src/lib/db/kosztorys-client-totals.ts`

**Intent**: Carry `ai_planned_qty` from `kosztorys_items` through the `item_qty` and `priced` CTEs and
fold it to a per-investment boolean in the final `SELECT`. A short comment names `hasAiDraft` as the
definition it mirrors.

**Contract**: The final `SELECT` gains `bool_or(ai_planned_qty IS NOT NULL) AS has_ai_draft`.
`KosztorysClientTotalsRowT` becomes `KosztorysClientTotalsT & { investmentId: number; hasAiDraft: boolean }`.
The mapper adds `hasAiDraft: row.has_ai_draft === true`. `KosztorysClientTotalsT` itself is untouched.

#### 2. Cache key + map type

**File**: `src/lib/queries/balances.ts`

**Intent**: Bump the cache key so no pre-deploy entry without the field is served. Widen the map type
so `shapeInvestments` can read the flag without forcing every hand-built test map to supply it.

**Contract**: `'kosztorys-client-totals-v1'` → `'kosztorys-client-totals-v2'`.
`KosztorysClientTotalsMapT = Record<string, KosztorysClientTotalsT & { hasAiDraft?: boolean }>`.

#### 3. Row type + shaping

**Files**: `src/types/table-rows.ts`, `src/lib/queries/shape-investments.ts`

**Intent**: Add `hasAiDraft: boolean` to `InvestmentRowT` next to `hasKosztorys`, set from
`clientTotals?.hasAiDraft ?? false`. A missing kosztorys means no draft.

**Contract**: `InvestmentRowT.hasAiDraft: boolean` (required, so the table never has to guess).

#### 4. Specs

**Files**: `src/__tests__/lib/db/kosztorys-client-totals.test.ts`,
`src/__tests__/lib/queries/shape-investments.test.ts`

**Intent**:

- DB spec. Add a fixture investment whose tree has one item with `aiPlannedQty: 0` and one with
  `aiPlannedQty: null`, and assert `hasAiDraft === true`. Zero counts on purpose: the agent left that
  item out, but a draft was loaded, which matches `hasAiDraft`'s `!== null`. Also assert the existing
  `perItem` fixture, which has no AI values, reads `false`. `createKosztorysTree` already accepts
  `aiPlannedQty` (`src/__tests__/helpers/kosztorys-db-tree.ts:106`).
- Unit spec: the flag passes through from the map, and an absent entry gives `false`.

**Contract**: No production contract; specs only.

### Success Criteria:

#### Automated Verification:

- DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-client-totals.test.ts`
- Unit spec passes: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`

#### Manual Verification:

- None for this phase. The flag is not visible until Phase 2.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: „Analiza AI” column

### Overview

Render the flag on the listing.

### Changes Required:

#### 1. Column definition

**File**: `src/components/tables/investments.tsx`

**Intent**: Add a `col.accessor('hasAiDraft', …)` column right after `kosztorysV2`, header
„Analiza AI”, cell „Tak” / „—”. This mirrors the „Opinia” column's „Wysłano” / „—”. Sorting is
enabled like on `hasSheet`. Not role-gated: the listing is already management-only.

**Contract**: Column id `hasAiDraft`. It is not added to `V2_COLUMN_IDS`: it is not a kosztorys-sourced
figure with a v1 twin, so the „Kolumny v2” switch must not hide it.

#### 2. DOM spec factory

**File**: `src/__tests__/components/tables/investments.test.tsx`

**Intent**: Add `hasAiDraft: false` to the `investment()` row factory so the spec type-checks
against the now-required field. No new assertion: the cell is a cosmetic two-value render.

**Contract**: Factory default only.

### Success Criteria:

#### Automated Verification:

- DOM spec passes: `pnpm exec vitest run src/__tests__/components/tables/investments.test.tsx`

#### Manual Verification:

- On `/inwestycje` (staging), an investment with a loaded agent draft shows „Tak” in „Analiza AI”, and
  its kosztorys editor shows the AI przedmiar column.
- An investment with an ordinary kosztorys and one with no kosztorys both show „—”.
- Sorting by „Analiza AI” groups the „Tak” rows together. The column can be hidden in the column
  picker, and toggling „Kolumny v2” does not hide it.

---

## Testing Strategy

### Unit Tests:

- `shapeInvestments`: flag passes through; absent kosztorys gives `false`.

### Integration Tests:

- `selectKosztorysClientTotals` against the 5435 test DB: `aiPlannedQty: 0` still counts as a draft;
  an ordinary kosztorys reads `false`. The existing parity assertions stay as they are. They compare
  named figures, so the new field does not affect them.

### Manual Testing Steps:

1. Open `/inwestycje` on staging and find an investment the AI draft loader ran against.
2. Confirm „Tak”, then open its kosztorys and confirm the AI przedmiar column is present.
3. Confirm „—” on an ordinary investment and on one with no kosztorys.

## Performance Considerations

One more `bool_or` in an aggregate that already scans every `kosztorys_items` row. There is no new
round trip and no new cache entry. The `-v2` key costs one cold recompute after deploy.

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

The full `pnpm test` and the parity suite are not run unasked. The pre-push hook runs the unit and
integration legs.

## References

- Definition mirrored: `src/lib/kosztorys/review-status.ts:12`
- Pattern followed: `hasKosztorys` in `src/lib/queries/shape-investments.ts:114`
- Aggregate: `src/lib/db/kosztorys-client-totals.ts:35`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Flag in the aggregate and the listing row

#### Automated

- [ ] 1.1 DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-client-totals.test.ts`
- [ ] 1.2 Unit spec passes: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`

### Phase 2: „Analiza AI” column

#### Automated

- [ ] 2.1 DOM spec passes: `pnpm exec vitest run src/__tests__/components/tables/investments.test.tsx`
