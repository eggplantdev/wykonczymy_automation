# „Etap AI” on the investment — Implementation Plan

## Overview

One stored field, `aiStage`, on the investment, set by hand from the investment page. The investments
listing folds it with the derived „Szkic wgrany” into the one „Analiza AI” column and filters on it.
`collect-reasons-prod.ts` defaults to the investments whose review is finished. Linear: **EX-1046**.

## Current State Analysis

- Nothing records where an investment stands in the knowledge flow
  (`context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md`, Method step 9). Which
  investments to read, and which are already lifted, lives in prose and memory.
- „Szkic wgrany” is already derived: `bool_or(ai_planned_qty IS NOT NULL) AS has_ai_draft` in
  `src/lib/db/kosztorys-client-totals.ts:91-93` → `hasAiDraft` (`src/lib/queries/shape-investments.ts:115`)
  → the „Analiza AI” column printing „Tak” / „—” (`src/components/tables/investments.tsx:121-127`).
- The knowledge scripts (`context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/`) never
  touch a DB: they read the deployed app's REST API (`prod-client.ts` `api()`) and write through
  scraped server actions. `collect-reasons-prod.ts:15-16` throws without `INVESTMENTS`.
- `updateInvestmentAction` (`src/lib/actions/investments.ts:157-183`) writes every field its schema
  carries, and `investment-notes.tsx:27-37` sends the whole record through it. The narrow-action
  precedent is `updateInvestmentClientFieldsAction` (`investments.ts:187-203`).
- `investmentAction` refuses writes on a zakończona inwestycja (`src/lib/actions/investment-action.ts:26-34`);
  `guardTrashedInvestment` (collection `beforeChange`) refuses writes on a trashed one.

## Desired End State

- `investments.ai_stage` — nullable pg enum `ready_for_analysis` | `review_done` | `knowledge_extracted`,
  no default (null = „—”).
- The investment page header carries an „Etap AI” select (—, Gotowa do analizy, Recenzja zakończona,
  Wiedza wyekstraktowana) for every management role, also on a zakończona inwestycja, hidden on a trashed one.
- The listing's „Analiza AI” cell prints the furthest step reached — Gotowa do analizy → Szkic wgrany →
  Recenzja zakończona → Wiedza wyekstraktowana, „—” for none — sorts in that order, and a „Analiza AI”
  multi-select filter narrows the listing to chosen steps.
- `collect-reasons-prod.ts` with no `INVESTMENTS` collects every investment at „Recenzja zakończona”.

### Key Discoveries:

- Enum-column migration precedent: `src/migrations/20260726_3_add_settlement_mode_to_investments.ts`
  (`DO $$ CREATE TYPE … EXCEPTION WHEN duplicate_object` + `ADD COLUMN IF NOT EXISTS`; down drops column then type).
- Constant-tuple pattern: `src/lib/constants/investment-status.ts` (`as const` tuple, `Record<…, { pl, en }>` labels,
  no `server-only` — the Payload CLI loads it).
- The investment read for both the page and the listing is `fetchReferenceData`
  (`src/lib/queries/reference-data.ts:76-82` SQL, `124-142` mapper, cache key `['reference-data-v8']` at `:187`).
- Client multi-filter primitives already exist: `useClientMultiFilter` (`src/hooks/use-client-multi-filter.ts`)
  + `FilterMultiSelect` (`src/components/filters/filter-multi-select.tsx`); `equipment-data-table.tsx:35-66`
  is the worked example over a closed constant list.
- Enum ↔ DB parity spec pattern: `src/__tests__/collections/investments-status.db.test.ts`.

## What We're NOT Doing

- No automatic transitions. „Wiedza wyekstraktowana” is set by hand; `apply-knowledge-prod.ts` is untouched.
- No reset when a Powód zmiany is written after extraction (owner ruling 2026-10-12: accepted).
- „Szkic wgrany” is not stored — it stays derived from `ai_planned_qty`.
- No field in the „Edytuj inwestycję” form, and `aiStage` does **not** enter `investmentSchema`.
- No role gate beyond management (`protectedAction`); no phone layout work (management, desktop).
- No persisted (localStorage) filter state — the AI filter is session state like the other `useClientMultiFilter` listings.

## Implementation Approach

Bottom-up: enum + column, then the one writer and the read path it needs, then the listing, then the
script. The listing's step is a pure function of `(aiStage, hasAiDraft)` in `src/lib`, so the cell,
the sort and the filter read one derivation and it is unit-testable without rendering.

## Critical Implementation Details

- **Cache key bump.** `InvestmentRefT` widens inside the `unstable_cache` payload of `fetchReferenceData`;
  tags don't cover a shape change (lessons: „Widening a type that flows through an `unstable_cache` payload
  needs a KEY bump”). Bump `reference-data-v8` → `v9` in the same edit that adds the column to the SELECT.
- **Keep `aiStage` out of `investmentSchema`.** Otherwise `updateInvestmentAction` and the notes save
  (both send the whole record) would write a default over the stage. Payload's `update` leaves absent fields alone.
- **Deploy order.** Additive migration → apply on prod (`pnpm db:migrate:prod`, human) **before** the push
  that ships the reading code; the reference-data SELECT names `ai_stage` on every page.

## Phase 1: Enum, column, collection field

### Overview

The stored field and its single source of values.

### Changes Required:

#### 1. Stage constants

**File**: `src/lib/constants/investment-ai-stage.ts` (new)

**Intent**: The one list of stored values and their labels, mirrored by the migration enum, the collection
options and the action's Zod schema.

**Contract**: `INVESTMENT_AI_STAGES = ['ready_for_analysis', 'review_done', 'knowledge_extracted'] as const`,
`InvestmentAiStageT`, `INVESTMENT_AI_STAGE_LABELS: Record<InvestmentAiStageT, { pl; en }>` —
„Gotowa do analizy” / „Recenzja zakończona” / „Wiedza wyekstraktowana”. No `server-only`.

#### 2. Migration

**File**: `src/migrations/20261012_0_add_investment_ai_stage.ts` (new) + `src/migrations/index.ts`

**Intent**: Hand-written, after `20260726_3`: create `enum_investments_ai_stage`, add nullable
`investments.ai_stage` with no default. `down` drops the column, then the type. Register in `index.ts`
(import + array entry). Check the day's counter is free with `ls src/migrations | grep 20261012` first.

**Contract**: column `ai_stage "enum_investments_ai_stage"` NULL.

#### 3. Collection field

**File**: `src/collections/investments.ts`

**Intent**: `aiStage` select, `required: false`, no `defaultValue`, options derived from the constants
(like `STATUS_OPTIONS`), label „Etap AI”. Then `pnpm generate:types` (gitignored output).

**Contract**: Payload field `aiStage` ↔ column `ai_stage`.

#### 4. Enum parity spec

**File**: `src/__tests__/collections/investments-ai-stage.db.test.ts` (new)

**Intent**: Same shape as `investments-status.db.test.ts`: for each value in `INVESTMENT_AI_STAGES`, a
Payload `update` stores it and raw SQL reads it back; `null` clears it. Catches a value added to the
tuple without a migration.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)
- Types regenerate: `pnpm generate:types`
- Parity spec passes: `pnpm exec vitest run src/__tests__/collections/investments-ai-stage.db.test.ts`

#### Manual Verification:

- None for this phase (no UI yet).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Set it on the investment page

### Overview

The one writer and the read path the page shows it from.

### Changes Required:

#### 1. Narrow action

**File**: `src/lib/actions/investments.ts`

**Intent**: `setInvestmentAiStageAction(id, aiStage)` — `protectedAction` (management; works on a
zakończona inwestycja, unlike `investmentAction`), validates with `z.enum(INVESTMENT_AI_STAGES).nullable()`,
`payload.update({ collection: 'investments', id, data: { aiStage }, user })`, revalidates `['investments']`.
A trashed investment is refused by the existing `guardTrashedInvestment`.

**Contract**: `(id: number, aiStage: InvestmentAiStageT | null) => Promise<ActionResultT>`.

#### 2. Read path

**Files**: `src/lib/queries/reference-data.ts`, `src/types/reference-data.ts`

**Intent**: Select `i.ai_stage::text`, map to `aiStage: InvestmentAiStageT | null` on `InvestmentRefT`,
bump the cache key to `reference-data-v9`.

**Contract**: `InvestmentRefT.aiStage: InvestmentAiStageT | null`.

#### 3. Header select

**File**: `src/components/investments/ai-stage-select.tsx` (new), `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: A compact select labelled „Etap AI” in the header row beside `OpenKosztorysV2Button`, options
„—” + the three labels, calling the action on change with a toast on failure (existing `toast` util) and
`router.refresh()` on success. Rendered only when the investment is not trashed.

**Contract**: props `{ investmentId: number; aiStage: InvestmentAiStageT | null }`.

#### 4. Action spec

**File**: `src/__tests__/lib/actions/investment-ai-stage.db.test.ts` (new)

**Intent**: Against the real Payload + DB: sets each stage and reads it back from the row; `null` clears;
an out-of-list value is refused with no write; a zakończona inwestycja accepts the write; a trashed one
is refused. Assert the persisted row, not the action's return value.

### Success Criteria:

#### Automated Verification:

- Action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/investment-ai-stage.db.test.ts`

#### Manual Verification:

- On `/inwestycje/[id]` (local, 5435 DB): pick „Gotowa do analizy”, reload — the select still shows it; pick „—”, reload — cleared.
- On a zakończona inwestycja the select is present and saves.
- On an investment in `/kosz` the select is absent.
- Saving the notes inline and saving „Edytuj inwestycję” leave the chosen stage unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Listing — one „Analiza AI” cell + filter

### Overview

Fold the stored stage and the derived draft into one step, show it, sort it, filter it.

### Changes Required:

#### 1. Step derivation

**File**: `src/lib/investments/ai-progress.ts` (new)

**Intent**: The listing's step as a pure function: `knowledge_extracted` > `review_done` > draft loaded
(`hasAiDraft`) > `ready_for_analysis` > none. Also exports the ordered step tuple and labels (adds
„Szkic wgrany” to the three stored labels), used by the cell, the sort and the filter options.

**Contract**: `AI_PROGRESS_STEPS = ['none', 'ready_for_analysis', 'draft_loaded', 'review_done', 'knowledge_extracted'] as const`,
`aiProgressOf(aiStage: InvestmentAiStageT | null, hasAiDraft: boolean): AiProgressStepT`,
`AI_PROGRESS_LABELS: Record<AiProgressStepT, string>` (`none` → „—”).

#### 2. Row shape

**Files**: `src/types/table-rows.ts`, `src/lib/queries/shape-investments.ts`

**Intent**: Replace the row's `hasAiDraft` with `aiProgress: AiProgressStepT`, computed in
`shapeInvestments` from `inv.aiStage` and `clientTotals?.hasAiDraft`. Check `hasAiDraft`'s other readers
(`grep -rn hasAiDraft src`) — keep it on the row only if one remains.

**Contract**: `InvestmentRowT.aiProgress: AiProgressStepT`.

#### 3. Column + filter

**Files**: `src/components/tables/investments.tsx`, `src/components/investments/investment-data-table.tsx`

**Intent**: The „Analiza AI” column (same id/header/cyan styling) prints `AI_PROGRESS_LABELS[step]`, sorts by
the step's index in `AI_PROGRESS_STEPS`. The toolbar gains a `FilterMultiSelect` „Analiza AI” over the five
steps, fed by `useClientMultiFilter` chained with the existing status and search filters — follow
`equipment-data-table.tsx:35-66`. Options come from the constant, not from the data.

### Success Criteria:

#### Automated Verification:

- Derivation spec passes: `pnpm exec vitest run src/__tests__/lib/investments/ai-progress.test.ts` (new — every `(aiStage, hasAiDraft)` pair, the precedence above)
- Shaping spec passes: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts` (updated for `aiProgress`)
- Listing columns spec passes: `pnpm exec vitest run src/__tests__/components/tables/investments.test.tsx` (row fixture moves `hasAiDraft` → `aiProgress`)

#### Manual Verification:

- `/inwestycje`: an investment with an AI draft and no stage shows „Szkic wgrany”; set it to „Recenzja zakończona” on its page → the listing shows „Recenzja zakończona”.
- Sorting „Analiza AI” orders — / Gotowa / Szkic / Recenzja / Wiedza.
- Filter „Analiza AI” → „Recenzja zakończona” leaves only those rows; combined with the status filter and search, all three narrow together.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Collect script default + docs

### Overview

The knowledge flow reads the stage instead of a hand-typed list.

### Changes Required:

#### 1. `collect-reasons-prod.ts`

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts`

**Intent**: Without `INVESTMENTS`, fetch ids via `api('/investments?where[aiStage][equals]=review_done&depth=0&limit=0')`;
print a line when none match instead of throwing. `INVESTMENTS` still overrides. Update the header usage comment.

**Contract**: env `INVESTMENTS` optional.

#### 2. Docs

**Files**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` (Method step 9),
`context/changes/2026-10-12-investment-ai-stage/change.md`

**Intent**: Step 9: owner sets „Recenzja zakończona” → `collect-reasons-prod.ts` with no args → … →
after `apply-knowledge-prod.ts`, set „Wiedza wyekstraktowana” by hand on each source investment. In this
change's note: „Wiedza wyekstraktowana” by hand, no reset, script untouched — resolve „Open for the plan”.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check (script runs only against prod; docs).

#### Manual Verification:

- After the prod deploy + migration: set „Recenzja zakończona” on one investment, run `TOKEN_FILE=… node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts` with no `INVESTMENTS` — it lists exactly that investment's Powody zmiany.

**Implementation Note**: Commit; manual checks roll into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- `aiProgressOf` — all 8 `(aiStage, hasAiDraft)` combinations; a stored stage past the draft wins over it, `ready_for_analysis` loses to a loaded draft.
- `shapeInvestments` — `aiProgress` from ref + client totals, incl. no kosztorys (`clientTotals` undefined → no draft).

### Integration Tests:

- Enum parity (`investments-ai-stage.db.test.ts`) and the action's persisted writes (`investment-ai-stage.db.test.ts`), both via `scripts/test-integration.sh` discovery.

### Manual Testing Steps:

1. Set each stage on an investment page; reload; check the listing cell.
2. Same on a zakończona inwestycja; confirm absent in `/kosz`.
3. Filter + sort on `/inwestycje`.

## Performance Considerations

One extra column in the reference-data SELECT; the filter is client-side over the already-loaded rows.

## Migration Notes

Additive, nullable, no backfill — every existing investment starts at „—”. Prod: `pnpm db:migrate:prod`
by a human before the push. Rollback: old code ignores the column; `down` drops column + type.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration`
- Full unit suite passes: `pnpm test`

## References

- Change note: `context/changes/2026-10-12-investment-ai-stage/change.md`
- Knowledge flow: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` (Method step 9)
- Derived draft flag: `context/changes/2026-10-09-investments-listing-ai-draft-column/`, `45d75b336`
- Enum migration precedent: `src/migrations/20260726_3_add_settlement_mode_to_investments.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Enum, column, collection field

#### Automated

- [x] 1.1 Migration applies to the local DB
- [x] 1.2 Types regenerate
- [x] 1.3 Parity spec passes — folded into the action DB spec (review gate: the standalone spec duplicated it)

### Phase 2: Set it on the investment page

#### Automated

- [x] 2.1 Action spec passes

### Phase 3: Listing — one „Analiza AI” cell + filter

#### Automated

- [x] 3.1 Derivation spec passes
- [x] 3.2 Shaping spec passes
- [x] 3.3 Listing columns spec passes

### Phase 4: Collect script default + docs

#### Automated

- [x] 4.1 No phase-scoped automated check
