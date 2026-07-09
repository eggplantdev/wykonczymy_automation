# Kosztorys stages (etapy) + per-item progress (S-04) Implementation Plan

## Overview

Add a variable number of **stages (etapy)** to an investment's kosztorys and let a Manager+
user record **per-item, per-stage progress** (ilość wykonana). Each stage renders as a dynamic
editable column in the existing `react-datasheet-grid` editor; a read-only **"Pozostało"**
(remaining = row net − Σ done-stage value) column reads out how much of each item is still
undone under the active price view.

This slice is **additive and port-first**: the pure calc/row core for stages was already
ported and unit-tested during S-01 and sits unused on this branch. S-04 supplies the missing
layers around it — two DB tables, two Payload collections, the query read, the mutation
actions, and the editor columns/wiring — following the same conventions S-01 established.

## Current State Analysis

The stage feature is scaffolded at the **pure-logic + type layer only**; everything
downstream is stubbed empty. Verified on branch `kosztorys-sections-items`:

- **Types (present):** `KosztorysStageT` (`id`, `ordinal`, `label`), `StageProgressT`
  (`itemId`, `stageId`, `qtyDone`), `KosztorysTreeT.stages`/`.progress`, and the flattened
  `KosztorysV2RowT` index signature `[stageKey: \`stage\_${number}\`]: number`
(`src/types/kosztorys.ts:77-114`).
- **Calc (present, tested):** `stageValueForView(row, qtyDone, view)`,
  `rowRemainingForView(row, doneNetTotal, view)` (`src/lib/kosztorys/calc.ts:52,61`).
- **Rows (present, tested):** `stageKey`, stage flattening in `treeToRows`,
  `diffRow.stageChanges` (scans `stage_`-prefixed keys), `buildBlankRow` stage-zeroing,
  `rowDoneNetForView(row, stages, view)` (`src/lib/kosztorys/v2-rows.ts:10,32,67,159,246`).
  Covered by `src/__tests__/kosztorys-calc.test.ts` + `kosztorys-v2-rows.test.ts`.
- **Migration (missing tables):** `src/migrations/20260708_2_add_kosztorys_sections_items.ts`
  creates `kosztorys_sections` + `kosztorys_items` only. No `kosztorys_stages` / `stage_progress`.
- **Collections (missing):** only `kosztorys-sections.ts` + `kosztorys-items.ts` exist;
  registered in `src/payload.config.ts:67-68`. Cache tags in `src/lib/cache/tags.ts:8-10`.
- **Query (stubbed):** `getKosztorysTree` returns `stages: [], progress: []` hard-coded
  (`src/lib/queries/kosztorys.ts:89`, comment at :20).
- **Actions (missing):** `src/lib/actions/kosztorys.ts` has item/section CRUD but no stage or
  progress action. Pattern = `protectedAction(label, handler, tags)` + `validateAction(zod, …)`.
- **Editor (gap):** `use-kosztorys-editor.ts` `onChange` (:298) handles only `diff.itemPatch`,
  not `diff.stageChanges`; `handleAddItem`/`handleAddSection` pass `stages: []` (:168,:226);
  `buildV2Columns` (`src/lib/tables/kosztorys-v2-columns.tsx:308`) builds no stage columns.

### Key Discoveries:

- **The pure core is done — this is a wiring slice, not a logic slice.** The risk sits entirely
  in persistence + UI integration, not in formulas.
- **dsg freezes `columns` at mount** — the load-bearing gotcha (already documented in
  `context/foundation/lessons.md`). The stage set shapes the columns, so a **`stagesKey`
  (e.g. `stages.map(s => s.id).join(',')`) MUST be added to the grid remount `key`**, or adding
  a stage silently renders no new column. The current key is
  `` `${view}:${sort?'sorted':'natural'}:${widthsKey}` `` (`kosztorys-editor-v2.tsx`).
- **Stage progress is a NEW save dimension.** Item edits save per-field via `updateItemFieldAction`
  keyed `item:${id}:${field}`. Stage cells produce `diff.stageChanges` (an array), which must save
  via `setStageProgressAction(itemId, stageId, qty)` keyed `progress:${itemId}:${stageId}` — a
  distinct branch in `onChange`, not a reuse of the item-patch path.
- **Sparse progress = 0.** A missing `stage_progress` row means 0 done. `treeToRows` already
  applies `?? 0`; the upsert (`ON CONFLICT (item_id, stage_id) DO UPDATE`) keeps it sparse.
- **Stage delete is guarded server-side:** blocked when any item has non-zero `qty_done` in that
  stage (POC `removeStageAction`). The header ✕ is the trigger; the guard is the authority.
- **`stages` come from local state, not the prop.** Like the POC, the editor holds
  `const [stages, setStages] = useState(tree.stages)` so add/remove optimistically add/drop a
  column; `stagesKey` derives from that state.

## Desired End State

On an investment's Kosztorys tab, a Manager+ user can: add a stage (a new "Etap N" column
appears), rename a stage via its header, and type each item's done-quantity per stage; the
"Pozostało" column recomputes live under the active price view; deleting a stage works unless
it holds recorded progress (then a toast tells them to clear it first). Stage progress
autosaves per cell (optimistic; the item grid's existing revert/refresh behaviour). Sparse
storage: untouched item×stage pairs persist nothing. Sections/items and the three-view toggle
behave exactly as before.

**Verify:** `pnpm typecheck` + `pnpm exec vitest run` green; new migration applies on docker
5433; manual author flow — add 2 stages, enter progress, confirm Pozostało + persistence across
`router.refresh()`, and the delete-guard toast.

## What We're NOT Doing

- **Stage reordering** — stages append by `ordinal`; no ▲▼ / drag on stage columns.
- **Per-stage dates, deadlines, statuses, or notes** — a stage is `ordinal` + optional `label` only.
- **VAT / brutto on stage values (S-12)** — stage values are netto, under the active view; no
  brutto column.
- **Hiding stage columns from MANAGER / column-locking (S-14), CSV export of stages (S-07),
  undo (S-13)** — later slices.
- **Any change to transfers, balances, marża/bilans, or the sheet mirror.** Additive only.
- **Browser E2E** — deferred to S-08. This slice unit-tests only the (already-covered) pure core
  plus any new action-shape helper; no new pure logic is introduced.

## Implementation Approach

Bottom-up, mirroring S-01 so each layer is verifiable before the next depends on it:
schema → collections/query → actions → editor UI. Port the POC's stage source where it exists
verbatim (`git show poc-kosztorys-in-app:<path>`) — the stage collections, `addStageAction`,
`removeStageAction`, `updateStageFieldAction`, `setStageProgressAction`, and the migration DDL
are directly reusable. The only genuinely new-shaped work is fitting stage columns + the
`diff.stageChanges` save branch into this branch's **decomposed** editor (POC was one file;
here logic lives in `use-kosztorys-editor.ts` and columns in `kosztorys-v2-columns.tsx`).

## Critical Implementation Details

- **Grid remount key (Phase 4):** add `stagesKey` to the `key` on the `DataSheetGrid` in
  `kosztorys-editor-v2.tsx`. Without it, `addStageAction` succeeds server-side but no column
  appears (dsg froze `columns` at mount). asc↔desc still doesn't remount; adding/removing a
  stage must.
- **No action inside a `setRows` updater (Phase 4):** the stage-progress save fires from
  `onChange` (event context), never from a `setRows` callback — same rule as item edits (the
  action's cache revalidation would move the Router during render).
- **`prevById` must include stage keys:** `diffRow` compares `stage_*` keys against the snapshot;
  `handleAddItem`/`handleAddSection` must build blank rows with the **current** `stages` (so the
  new row carries `stage_*: 0` keys) and set `prevById` accordingly, or the first progress entry
  on a fresh row won't diff.
- **Adding a stage must patch existing rows + `prevById`:** a new stage adds a `stage_${id}: 0`
  key to every current row and snapshot (like `patchRows` for coeffs), so subsequent diffs are
  correct and the column renders 0s rather than blanks.

## Phase 1: Schema

### Overview

Additive migration creating `kosztorys_stages` + `stage_progress`, plus the Payload
`payload_locked_documents_rels` FK columns/indexes the adapter expects for two new collections.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260709_add_kosztorys_stages.ts` (name after the latest existing file)

**Intent**: Create the two stage tables additively, with the uniqueness constraints the app
relies on (one ordinal per investment; one progress row per item×stage).

**Contract**: `up`/`down` with `sql` from `@payloadcms/db-vercel-postgres`, `IF NOT EXISTS`,
explicit FK `ON DELETE CASCADE`. Port DDL from
`git show poc-kosztorys-in-app:src/migrations/20260620_add_kosztorys_tables.ts` (the stage
portion only — **not** rooms):

- `kosztorys_stages`: `id` serial PK; `investment_id` int NOT NULL REFERENCES `investments(id)`
  CASCADE; `ordinal` int NOT NULL; `label` varchar NULL; timestamps; `CONSTRAINT
kosztorys_stages_investment_ordinal_unique UNIQUE (investment_id, ordinal)`. Index on
  `investment_id`.
- `stage_progress`: `id` serial PK; `item_id` int NOT NULL REFERENCES `kosztorys_items(id)`
  CASCADE; `stage_id` int NOT NULL REFERENCES `kosztorys_stages(id)` CASCADE; `qty_done` numeric
  NOT NULL DEFAULT 0; timestamps; `CONSTRAINT stage_progress_item_stage_unique UNIQUE (item_id,
stage_id)` (**required** — `setStageProgressAction`'s `ON CONFLICT` depends on it). Indexes on
  `item_id` and `stage_id`.
- `payload_locked_documents_rels`: `ADD COLUMN IF NOT EXISTS kosztorys_stages_id integer
REFERENCES kosztorys_stages(id) ON DELETE CASCADE`, same for `stage_progress_id`, + their
  indexes (mirror the S-01 migration's handling of the two prior collections).

`down` drops the two rels columns then the two tables. Register in `src/migrations/index.ts`.
Hand-write; do not trust `migrate:create`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local docker: `pnpm payload migrate` (against 5433)
- Types regenerate without error: `pnpm generate:types`
- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

#### Manual Verification:

- `kosztorys_stages` + `stage_progress` exist with the two UNIQUE constraints; no existing
  table other than `payload_locked_documents_rels` changed.

**Implementation Note**: After automated verification passes, pause for human confirmation
before Phase 2.

---

## Phase 2: Collections + query

### Overview

Register the two Payload collections, add cache tags, and replace the query's empty stubs with
real reads.

### Changes Required:

#### 1. Collections

**File**: `src/collections/kosztorys-stages.ts`, `src/collections/stage-progress.ts`

**Intent**: Payload configs matching the migration columns so actions can use
`payload.create/update/delete` and types regenerate.

**Contract**: Port `git show poc-kosztorys-in-app:src/collections/kosztorys-stages.ts` and
`:stage-progress.ts` nearly verbatim. `kosztorys-stages`: fields `investment` (relationship),
`ordinal` (number, required), `label` (text, optional). `stage-progress`: fields `item`
(relationship→kosztorys-items), `stage` (relationship→kosztorys-stages), `qtyDone` (number,
required, default 0). `admin.group = { en: 'Kosztorys', pl: 'Kosztorys' }`. Access =
`isAdminOrOwnerOrManager` (all four ops). Hooks =
`makeRevalidateAfterChange/Delete('kosztorysStages' | 'stageProgress')`.

#### 2. Register + cache tags

**File**: `src/payload.config.ts`, `src/lib/cache/tags.ts`

**Intent**: Register both collections; add their cache-tag keys.

**Contract**: Import + append `KosztorysStages`, `StageProgress` to the `collections` array.
Add `kosztorysStages: 'collection:kosztorys-stages'` and `stageProgress:
'collection:stage-progress'` to `CACHE_TAGS`.

#### 3. Query — read stages + progress

**File**: `src/lib/queries/kosztorys.ts`

**Intent**: Replace the `stages: [], progress: []` stub with real reads so the tree carries the
investment's stages (ordered by `ordinal`) and all its progress rows.

**Contract**: Add two `payload.find` calls to the existing `Promise.all`: stages
`where investment = investmentId`, `sort: 'ordinal'`, mapped to `KosztorysStageT[]`; progress
for the investment's items (via `item.investment` relationship filter, or by the item ids
already fetched), mapped to `StageProgressT[]` (`itemId`, `stageId`, `qtyDone`). Return them in
place of the empty arrays; drop the stale "out of scope" comment at :20.

### Success Criteria:

#### Automated Verification:

- Types regenerate: `pnpm generate:types`
- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Existing unit suite still green: `pnpm exec vitest run`

#### Manual Verification:

- Both collections appear under the "Kosztorys" admin group; a stage + a progress row can be
  created there against a test investment.
- `getKosztorysTree(testInvestmentId)` returns the stages (ordered) and progress rows (spot via
  a scratch script or the page).

---

## Phase 3: Server actions

### Overview

Port the four stage/progress mutations, all through `protectedAction` (MANAGEMENT_ROLES) with
cache tags.

### Changes Required:

#### 1. Stage + progress actions

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Add stage lifecycle + the sparse progress upsert.

**Contract**: Port from `git show poc-kosztorys-in-app:src/lib/actions/kosztorys.ts`:

- `addStageAction(investmentId)` → `ActionResultT<{ id; ordinal }>`: next ordinal =
  `max(ordinal)+1` for the investment; `payload.create`. Tag `['kosztorysStages']`.
- `removeStageAction(stageId)` → `ActionResultT`: raw-SQL guard
  `SELECT 1 FROM stage_progress WHERE stage_id = … AND qty_done <> 0 LIMIT 1`; if found, return
  `{ success: false, error: 'Najpierw wyczyść ilości wpisane w tym etapie' }`; else
  `payload.delete`. Tags `['kosztorysStages', 'stageProgress']`.
- `updateStageFieldAction(stageId, label)` → validates `{ label: string | null }` via
  `validateAction`; `payload.update`. Tag `['kosztorysStages']`.
- `setStageProgressAction(itemId, stageId, qtyDone)`: raw-SQL upsert via `getDb(payload)` —
  `INSERT INTO stage_progress (…) VALUES (…) ON CONFLICT (item_id, stage_id) DO UPDATE SET
qty_done = …, updated_at = now()`. Tag `['stageProgress']`. Zod-validate the numeric inputs.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit suite still green: `pnpm exec vitest run`

#### Manual Verification:

- From a scratch script/admin: `addStageAction` yields ordinal N+1; `setStageProgressAction`
  twice on the same item×stage updates one row (upsert, not duplicate); `removeStageAction` is
  blocked while a non-zero `qty_done` exists and succeeds after it is cleared.

---

## Phase 4: Editor UI

### Overview

Render dynamic stage columns + a "Pozostało" column, add/rename/delete-stage controls, and wire
per-cell stage-progress autosave — honoring the dsg remount-key and no-action-in-updater rules.

### Changes Required:

#### 1. Stage columns + Pozostało

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Build one editable `floatColumn` per stage (keyed `stage_${id}`, titled from
`label` ?? `Etap ${ordinal}`, with a header ✕ delete + rename control) and a trailing read-only
"Pozostało" computed column.

**Contract**: `buildV2Columns` gains `stages: KosztorysStageT[]`, `onRemoveStage(stageId)`,
`onRenameStage(stageId, label)`, and the derived-value helper it needs (`rowDoneNetForView`
already exists). Port the stage/`Pozostało` column construction from
`git show poc-kosztorys-in-app:src/lib/tables/kosztorys-v2-columns.tsx` (see its stage map +
`remaining` column and `v2ToggleableColumns`), adapting to this branch's column helpers. The
stage column's cell closure must read fresh data (dsg freezes at mount) — follow the existing
computed-column pattern in this file. Pozostało = `rowRemainingForView(row,
rowDoneNetForView(row, stages, view), view)`, formatted read-only.

#### 2. Editor state + handlers + save branch

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Own the stage set locally, wire add/rename/remove, route stage-cell edits to the
progress action, and keep blank rows/snapshots stage-aware.

**Contract**:

- Add `const [stages, setStages] = useState(tree.stages)`; pass `stages` into `buildV2Columns`
  and expose `stagesKey = stages.map(s => s.id).join(',')`.
- `handleAddStage`: `await addStageAction(investmentId)`; on success append to `stages` and
  `patchRows(() => true, r => ({ ...r, [stageKey(id)]: 0 }))` (rows + `prevById`) so every row
  gains the column at 0.
- `handleRemoveStage(stageId)`: `await removeStageAction`; on failure `toastMessage(res.error,
'warning')`; on success drop from `stages` and delete the `stage_${id}` key from rows +
  `prevById`.
- `handleRenameStage(stageId, label)`: optimistic `setStages` + `void updateStageFieldAction`.
- **`onChange` stage branch**: after the existing `diff.itemPatch` handling, for each entry in
  `diff.stageChanges ?? []` call `save(\`progress:${row.id}:${sc.stageId}\`, () =>
  setStageProgressAction(row.id, sc.stageId, sc.qty), <revert>)`and include the row in`changedById`so the merge + delayed`router.refresh()`still fire. Revert restores the prior`stage\_${id}`value from the snapshot (same shape as`revertOne`).
- Stop passing `stages: []` in `handleAddItem`/`handleAddSection` — pass the current `stages` so
  new rows carry `stage_*: 0` keys; set the built row into `prevById` as today.
- `sortValue`: add a `case 'remaining'` returning `rowRemainingForView(row,
rowDoneNetForView(row, stages, view), view)` (needs `stages` in the closure/deps).

#### 3. Grid remount key + add-stage button

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx`,
`src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: Force a remount when the stage set changes and expose the `＋ etap` control.

**Contract**: Extend the grid `key` to
`` `${view}:${sort?'sorted':'natural'}:${widthsKey}:${stagesKey}` ``. Add a `＋ etap` button to
the toolbar wired to `handleAddStage` (sibling of the existing add-section control).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit suite green: `pnpm exec vitest run`
- Build compiles: `pnpm build`

#### Manual Verification:

- Add a stage → a new "Etap N" column appears (remount-key check); add a second stage → second
  column, existing rows show 0s.
- Rename a stage via its header → title updates and persists across `router.refresh()`.
- Enter done-quantities → "Pozostało" recomputes live and matches hand computation; toggle the
  three price views → stage values + Pozostało recompute.
- Progress persists across reload; entering the same cell twice does not create duplicate rows.
- Delete a stage with recorded progress → blocked with the toast; clear the quantities, delete
  → column disappears.
- EMPLOYEE still has no kosztorys access; sections/items/reorder/discount behave as before.

**Implementation Note**: Final human sign-off here closes the slice → run the slice-review gate.

---

## Testing Strategy

### Unit Tests:

The stage pure core (`stageValueForView`, `rowRemainingForView`, `stageKey`,
`diffRow.stageChanges`, `rowDoneNetForView`) is **already covered** by
`src/__tests__/kosztorys-calc.test.ts` + `kosztorys-v2-rows.test.ts`. Add a case only if a new
pure helper is introduced (none expected — the UI/action layers are integration surface,
covered manually here and by S-08 E2E later).

### Integration / E2E:

- **Deferred to S-08** (editor E2E coverage) on the F-01 Playwright harness.

### Manual Testing Steps:

1. Add two stages; confirm two new columns and existing rows at 0.
2. Rename a stage via header; reload → name sticks.
3. Enter progress; Pozostało updates; toggle views → recompute.
4. Reload → progress persists; re-enter same cell → no duplicate row (upsert).
5. Delete a stage holding progress → blocked toast; clear + delete → column gone.
6. Sections/items/reorder/discount unchanged; EMPLOYEE no access; financial figures unchanged.

## Performance Considerations

Stage columns add K editable columns and a Pozostało reduce per row. At 1000+ rows the
Pozostało column is one O(stages) reduce per row per render — acceptable with React Compiler on;
watch the dsg remount cost when adding a stage at large row counts during manual verification.
Progress saves are per-cell debounced (`useDebouncedSave(500)`), keyed
`progress:${itemId}:${stageId}`, so only the touched pair writes (the "writes = real change"
lesson).

## Migration Notes

Additive only. `up` creates two tables + two `payload_locked_documents_rels` columns; `down`
reverses. Apply locally against docker 5433 via `pnpm payload migrate`. Prod is applied by a
human via `pnpm db:migrate:prod` **before** the code that needs it ships — never by the agent
(`payload-prod-migrate` skill). No data backfill.

## References

- Change identity: `context/changes/kosztorys-stages/change.md`
- Roadmap slice S-04: `context/foundation/roadmap.md`
- POC decision register: `context/changes/kosztorys-mvp/change.md`
- S-01 plan (conventions + what stages were deferred): `context/changes/kosztorys-sections-items/plan.md`
- POC source to port: `git show poc-kosztorys-in-app:<path>` — `src/collections/kosztorys-stages.ts`,
  `:stage-progress.ts`, `src/lib/actions/kosztorys.ts` (stage actions),
  `src/migrations/20260620_add_kosztorys_tables.ts` (stage DDL),
  `src/lib/tables/kosztorys-v2-columns.tsx` (stage columns), `src/components/kosztorys/kosztorys-editor-v2.tsx`
- dsg remount-key lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema

#### Automated

- [x] 1.1 Migration applies cleanly on local docker (`pnpm payload migrate`)
- [x] 1.2 Types regenerate (`pnpm generate:types`)
- [x] 1.3 Type checking passes (`pnpm typecheck`)
- [x] 1.4 Lint passes (`pnpm lint`)

#### Manual

- [x] 1.5 Both tables + UNIQUE constraints exist; no unexpected table changed

### Phase 2: Collections + query

#### Automated

- [ ] 2.1 Types regenerate (`pnpm generate:types`)
- [ ] 2.2 Type checking passes
- [ ] 2.3 Lint passes
- [ ] 2.4 Existing unit suite still green (`pnpm exec vitest run`)

#### Manual

- [ ] 2.5 Both collections appear under "Kosztorys"; stage + progress creatable in admin
- [ ] 2.6 `getKosztorysTree` returns ordered stages + progress rows

### Phase 3: Server actions

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Lint passes
- [ ] 3.3 Unit suite still green

#### Manual

- [ ] 3.4 addStage yields N+1; setStageProgress upserts (no dup); removeStage guard blocks then allows

### Phase 4: Editor UI

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Lint passes
- [ ] 4.3 Unit suite green
- [ ] 4.4 Build compiles (`pnpm build`)

#### Manual

- [ ] 4.5 Add stage → new column (remount-key); second stage → existing rows show 0
- [ ] 4.6 Rename stage via header persists across refresh
- [ ] 4.7 Progress entry → Pozostało recomputes live; view toggle recomputes
- [ ] 4.8 Progress persists across reload; no duplicate row on re-entry (upsert)
- [ ] 4.9 Delete stage with progress blocked (toast); clear + delete removes column
- [ ] 4.10 EMPLOYEE no access; sections/items/reorder/discount unchanged; financials unchanged
