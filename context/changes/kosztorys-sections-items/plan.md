# Kosztorys — sections + items with live totals (S-01) Implementation Plan

## Overview

Build the first owner-visible proof that the kosztorys can live in the app instead of Google
Sheets: an additive, test-gated in-app editor for one investment's **sections + items** with
**live row/section/grand totals**. Each row is a work item in a flat `react-datasheet-grid`;
section is a denormalized column. Prices use the **coefficient model** (client price is the
snapshot; the two subcontractor views are derived from a markup coefficient
investment→section→item-override) behind a **three-view toggle**. Per-field optimistic autosave
with revert-on-error; ▲▼ reorder within a section via a 2-write swap. Values are **computed,
never stored** — only inputs persist.

This slice ports the POC's already-built, already-tested calc core rather than reinventing it.
It is **additive-only**: no existing table is altered except two additive columns on
`investments`; no transfer/balance/marża write path is touched (FR-015).

## Current State Analysis

- **No in-app editor exists on `main`.** The kosztorys is Google-Sheet-backed: `sheets.ts`
  (slug `kosztoryses`) holds a sheet id, rendered via an iframe + a one-way `INVESTMENT_EXPENSE`
  mirror. That stays untouched and keeps working (FR-014, FR-016).
- **A complete POC exists on branch `poc-kosztorys-in-app`** (not on `main`). Its calc core
  (`src/lib/kosztorys/calc.ts`, `v2-rows.ts`, `src/types/kosztorys.ts`) is pure and unit-tested;
  its editor, actions, queries, and collections are built and wired end-to-end. The POC's schema
  evolved across three migrations into the **coefficient + VAT-per-investment** model. Archived
  design docs: `context/archive/kosztorys-poc-in-app/`.
- **Conventions to follow** (verified in the current tree):
  - Collections: bilingual `labels`, `admin.group`, `makeRevalidateAfterChange/Delete` hooks,
    `@/access` fns, registered in `src/payload.config.ts` (see `src/collections/sheets.ts`,
    `investments.ts`).
  - Mutations: `protectedAction(label, handler, revalidateTags)` → `ActionResultT`, Zod via
    `validateAction`, `updateTag` for cache (`src/lib/actions/run-action.ts`,
    `transfers.ts:28`). Cache keys in `src/lib/cache/tags.ts`.
  - Raw reads: `getDb(payload)` + `sql` from `@payloadcms/db-vercel-postgres`
    (`src/lib/db/get-db.ts`) — **not** a direct `@vercel/postgres` import.
  - Migrations: hand-written `YYYYMMDD[_n]_desc.ts`, `up`/`down` with `sql`, `IF NOT EXISTS`,
    explicit FK `ON DELETE CASCADE`, registered in `src/migrations/index.ts`.
  - Access: `MANAGEMENT_ROLES = [ADMIN, OWNER, MANAGER]`, EMPLOYEE excluded
    (`src/lib/auth/roles.ts`, `src/access/index.ts`).

### Key Discoveries:

- **`react-datasheet-grid` freezes its `columns` prop at mount** — the single most important
  gotcha. Any dimension that shapes columns (active price `view`, `sort` on/off, column widths,
  hidden set) must be baked into the grid's `key` to force a remount, or the feature silently
  no-ops (all three price views showed the client price until `view` entered the key). This
  lesson lives only on the POC branch's `lessons.md` — **port it forward** (Phase 2).
- **Reorder write-count**: ▲▼ is always a swap of two neighbors → `swapItemOrderAction` does
  exactly 2 updates regardless of section size. Renumbering the whole section (the POC's
  earlier `reorderItemsAction`) is an N-write dławik at 1000+ rows — the "writes = real change"
  lesson. Keep `swapItemOrderAction` for ▲▼; `reorderItemsAction` stays only for future
  cross-section moves.
- **Invariant: every section has ≥1 item.** A flat grid can't show an empty section (0 rows).
  New section is created with one blank item; deleting a section's last item is blocked.
- **Values computed from `measuredQty` (pomiar), not `plannedQty` (przedmiar).** Both are
  independent editable columns; the template seeds pomiar from przedmiar.
- Calc signatures to port (`calc.ts`): `rowNet`, `rowGross(item, vatRate)`, `effectiveCoeff`,
  `subcontractorPrice`, `viewPrice`, `rowNetForView`, `sectionSubtotalsForView`. Row helpers
  (`v2-rows.ts`): `treeToRows`, `diffRow`, `filterRows`, `sortRows`, `revertField`,
  `buildBlankRow`, `applyAddItem`, `applyRemoveItem`, `sectionItemCount`, `swapItemInSection`,
  `sectionNeighbor`.

## Desired End State

A Manager+ user opens an investment's new "Kosztorys" tab and can: add/rename/delete/filter
sections; add/inline-edit/delete/reorder (▲▼) items (description, unit, przedmiar, pomiar,
discount, client price + subcontractor overrides, cost variant, note); toggle the three price
views; and watch row, section, and grand totals recompute live. Edits autosave per field
(optimistic, revert-on-error). No Google Sheet is involved. The pure calc + row helpers are
unit-tested and green. The "Arkusz" tab still works for sheet-backed investments.

**Verify**: `pnpm typecheck` + `pnpm exec vitest run` green; migration applies on local docker
(5433); manual author flow on a test investment produces totals matching hand computation.

## What We're NOT Doing

- **Stages/etapy (S-04)** — no `kosztorys_stages` / `stage_progress` tables, no stage columns.
  calc's stage functions are ported (pure, harmless) but unused; the tree read returns empty
  `stages`/`progress`.
- **VAT (S-12)** — no `investments.vat_rate`; values are **netto only**. `rowGross` is ported
  but unwired (`vatRate` denormalized as `0`). No netto/brutto toggle.
- **Rooms/pokoje** — cut from scope; no `kosztorys_rooms` table.
- **Catalogue/autocomplete (S-06), CSV/print export (S-07), undo (S-13), column-locking /
  hidden-in-export / hide-from-MANAGER (S-14)** — later slices. No `hidden_in_export` UI, no
  print/export step.
- **Drag-drop reorder, cross-section move, section reorder** — ▲▼ within-section only.
- **Browser E2E** — deferred to S-08. This slice unit-tests the pure core only.
- **Any change to transfers, balances, marża/bilans, or the sheet mirror.**

## Implementation Approach

Port-first. The POC branch holds working, tested source for nearly every piece; the work is
(a) trimming it to the S-01 surface (drop stages/VAT/rooms/export), (b) fitting it to `main`'s
current conventions, and (c) landing the unit tests the POC deferred. Read POC source with
`git show poc-kosztorys-in-app:<path>`. Build bottom-up: schema → tested calc core → actions +
queries → editor UI → page wiring, so each layer is verifiable before the next depends on it.

## Critical Implementation Details

- **dsg remount key** (Phase 4): the grid's `key` must include `view`, `sort` on/off,
  `widthsKey`, and (future) hidden/stages signatures — ``key={`${view}:${sort?'sorted':'natural'}:${widthsKey}`}``.
  asc↔desc does not remount (arrow state unchanged); entering/leaving sort does. Omitting a
  dimension makes that feature silently no-op.
- **Never fire a server action inside a `setRows` updater** (Phase 4): the action's cache
  revalidation nudges the Router mid-render → React error. Fire from the event handler; read
  fresh rows from a latest-value ref because the dsg column closure is frozen at mount.
- **`prevById` ref** tracks the row set for diffing autosave edits; keep it in sync with the
  optimistic splice (add→set, remove→delete) so `diffRow` stays correct.

## Phase 1: Schema + collections

### Overview

Additive migration creating `kosztorys_sections` + `kosztorys_items` in their **final
coefficient shape** (no per-item/section VAT, no stored subcontractor price columns), plus two
additive coefficient columns on `investments`. Register both as Payload collections. Wire cache
tags.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260708_2_add_kosztorys_sections_items.ts` (name after the latest
existing file's date/index)

**Intent**: Create the two new tables and add investment-level markup coefficients, additively.

**Contract**: `up`/`down` using `sql` from `@payloadcms/db-vercel-postgres`. Tables (snake_case,
Payload adapter mapping; `created_at`/`updated_at` timestamptz like every other table):

- `kosztorys_sections`: `id` serial PK; `investment_id` int NOT NULL REFERENCES
  `investments(id)` ON DELETE CASCADE; `name` varchar NOT NULL; `display_order` int NOT NULL
  DEFAULT 0; `default_cost_variant` varchar NOT NULL DEFAULT `'w_tools'`; `w_tools_coeff`
  numeric NULL; `own_tools_coeff` numeric NULL. Index on `investment_id`.
  **Omit** `vat_rate` (VAT is S-12).
- `kosztorys_items`: `id` serial PK; `investment_id` int NOT NULL CASCADE; `section_id` int NOT
  NULL REFERENCES `kosztorys_sections(id)` ON DELETE CASCADE; `display_order` int NOT NULL
  DEFAULT 0; `description` varchar; `unit` varchar; `planned_qty` numeric NOT NULL DEFAULT 0;
  `measured_qty` numeric NOT NULL DEFAULT 0; `discount_type` varchar; `discount_value` numeric
  NOT NULL DEFAULT 0; `client_price` numeric NOT NULL DEFAULT 0; `w_tools_override_type`
  varchar; `w_tools_override_value` numeric NOT NULL DEFAULT 0; `own_tools_override_type`
  varchar; `own_tools_override_value` numeric NOT NULL DEFAULT 0; `cost_variant` varchar;
  `hidden_in_export` boolean NOT NULL DEFAULT false; `note` varchar. Indexes on `investment_id`
  and `section_id`. **Omit** `vat_rate` and the two stored `subcontractor_*_price` columns
  (superseded by the override model).
- `ALTER TABLE investments ADD COLUMN IF NOT EXISTS w_tools_coeff numeric NOT NULL DEFAULT
0.65`, same for `own_tools_coeff` DEFAULT 0.55.

`down` drops the two tables and the two investment columns. Register in
`src/migrations/index.ts`. Hand-write; do not trust `migrate:create`.

#### 2. Collections

**File**: `src/collections/kosztorys-sections.ts`, `src/collections/kosztorys-items.ts`

**Intent**: Payload collection configs matching the migration columns and the app's collection
conventions, so actions can use `payload.create/update/delete` and types regenerate.

**Contract**: Port the POC collections nearly verbatim (`git show
poc-kosztorys-in-app:src/collections/kosztorys-sections.ts` / `:kosztorys-items.ts`) with these
deltas: **drop** any `vatRate` field (both); **drop** the stored `subcontractorWToolsPrice` /
`subcontractorOwnToolsPrice` if present; **keep** the override fields (`wToolsOverrideType/Value`,
`ownToolsOverrideType/Value`) and section coeffs (`wToolsCoeff`, `ownToolsCoeff`). `admin.group`
= `{ en: 'Kosztorys', pl: 'Kosztorys' }`. Access = `isAdminOrOwnerOrManager` for all four ops.
Hooks = `makeRevalidateAfterChange/Delete('kosztorysSections' | 'kosztorysItems')`.

#### 3. Register + cache tags + investment field

**File**: `src/payload.config.ts`, `src/lib/cache/tags.ts`, `src/collections/investments.ts`

**Intent**: Register both collections; add cache-tag keys; add the two coefficient number
fields to the investments collection so Payload knows the additive columns.

**Contract**: Import + append to the `collections` array. Add `kosztorysSections:
'collection:kosztorys-sections'` and `kosztorysItems: 'collection:kosztorys-items'` to
`CACHE_TAGS`. Add `wToolsCoeff` / `ownToolsCoeff` `number` fields to `investments.ts`
(bilingual labels; the migration already created the columns with defaults).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local docker: `pnpm payload migrate` (against 5433)
- Types regenerate without error: `pnpm generate:types`
- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Both collections appear under the "Kosztorys" admin group; a section + item can be created in
  the Payload admin against a test investment.
- `investments` rows show `w_tools_coeff` / `own_tools_coeff` defaults (0.65 / 0.55).
- No existing table other than `investments` changed; `kosztoryses`/sheet flow untouched.

**Implementation Note**: After automated verification passes, pause for human confirmation of
the manual checks before Phase 2.

---

## Phase 2: Port the tested calc core

### Overview

Bring the pure calc + row-transform core and its types from the POC branch, and land the unit
tests the POC deferred. Green here gates all UI work.

### Changes Required:

#### 1. Types + calc + row helpers

**File**: `src/types/kosztorys.ts`, `src/lib/kosztorys/calc.ts`, `src/lib/kosztorys/v2-rows.ts`

**Intent**: Port the pure core verbatim (it already assumes the coefficient model). Trim only
what references dropped surfaces where it causes type errors.

**Contract**: `git show poc-kosztorys-in-app:<path>` for each. `types/kosztorys.ts`: keep the
coefficient/override types and `KosztorysV2RowT`; `vatRate` stays on the row type but the tree
read supplies `0`. Stage types (`KosztorysStageT`, `StageProgressT`) may stay (unused) to keep
the port clean. `calc.ts` and `v2-rows.ts`: port whole — pure, tested, no runtime cost from
unused stage functions.

#### 2. Unit tests

**File**: `src/__tests__/kosztorys-calc.test.ts`, `src/__tests__/kosztorys-v2-rows.test.ts`

**Intent**: Port the POC specs and confirm they assert observable behavior (computed values,
state transforms), not implementation. Cover the S-01-critical paths.

**Contract**: Port `git show poc-kosztorys-in-app:src/__tests__/kosztorys-calc.test.ts` and
`:kosztorys-v2-rows.test.ts`. Must cover: `rowNet` with percent vs amount discount; `viewPrice`
/ `subcontractorPrice` for `null` (derived), `coeff`, `amount` overrides + section-over-global
`effectiveCoeff`; `sectionSubtotalsForView` grouping + `share`; `treeToRows` denormalization +
stage sparsity → 0; `diffRow` picks only changed editable fields; `swapItemInSection` /
`sectionNeighbor` swap-in-middle + no-op at block edge + tolerance for an item appended to the
end of `rows`; `sectionItemCount` for the ≥1-item invariant. Drop assertions on dropped surfaces
(VAT-cascade, stages) if any.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts`
- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- Spot-check one worked example by hand (e.g. pomiar 10 × client 100 − 10% = 900 net; w_tools
  view with section coeff 0.6 = 10 × 60 = 600 net) against the test output.

---

## Phase 3: Server actions + query

### Overview

Port the tree read and the mutation actions for the S-01 surface. All mutations go through
`protectedAction` (MANAGEMENT_ROLES) + `updateTag`.

### Changes Required:

#### 1. Query — investment kosztorys tree

**File**: `src/lib/queries/kosztorys.ts`

**Intent**: Read one investment's sections + items into `KosztorysTreeT`, ordered
section.display_order → item.display_order, with global coeffs from the investment and empty
stages/progress.

**Contract**: Port `getKosztorysTree(investmentId): Promise<KosztorysTreeT>` (`git show
poc-kosztorys-in-app:src/lib/queries/kosztorys.ts`) via `getDb(payload)` + `sql`. Deltas:
`vatRate` = `0` (no VAT column); `stages`/`progress` = `[]` (no stage tables); `globalCoeffs`
from `investments.w_tools_coeff`/`own_tools_coeff`. Order items within section by `display_order`
(the reorder swap depends on this ordering).

#### 2. Actions

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Port the section/item mutations for the S-01 surface; drop stage actions.

**Contract**: Port from `git show poc-kosztorys-in-app:src/lib/actions/kosztorys.ts`, keeping:
`addSectionAction` (returns `{ id, displayOrder }`; new section also creates one blank item —
either a thin `addSectionWithItemAction` or client-side `addSection`→`addItem` sequence),
`removeSectionAction`, `addItemAction` (returns `{ id, displayOrder }`), `removeItemAction`,
`updateItemFieldAction(itemId, patch)`, `updateSectionFieldAction(sectionId, patch)`,
`updateInvestmentCoeffsAction`, `swapItemOrderAction(first, second)` (2-write neighbor swap).
Keep `reorderItemsAction` only if the port is clean (reserved for future cross-section move —
not wired to ▲▼). **Drop** `updateStageFieldAction`, `setStageProgressAction`, `addStageAction`,
`removeStageAction`. Each action: `protectedAction` with tag `['kosztorysItems']` /
`['kosztorysSections']` (+ `['investments']` where the listing joins). Zod-validate id/order
payloads via `validateAction`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Existing unit suite still green: `pnpm exec vitest run`

#### Manual Verification:

- From a scratch script or the admin, `getKosztorysTree(testInvestmentId)` returns sections
  ordered with their items; adding a section yields exactly one blank item;
  `swapItemOrderAction` swaps two neighbors' `display_order` (2 rows changed, not N).

---

## Phase 4: Editor UI

### Overview

Port the `react-datasheet-grid` editor and the "Sekcje" control-desk panel, trimmed to the S-01
surface (no stage columns, no VAT/brutto, no export/hidden toggles). Wire the view toggle,
reorder arrows, and optimistic per-field autosave, honoring the dsg remount-key and
no-action-in-updater gotchas.

### Changes Required:

#### 1. Editor component

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx` (+ `kosztorys-section-summary.tsx`,
`src/lib/tables/kosztorys-v2-columns.tsx`)

**Intent**: Flat grid (row = item, section = denormalized read-only column) seeded from
`treeToRows`; `lockRows` on; structure changes via own buttons + `setRows`; per-field autosave
via `diffRow` → `updateItemFieldAction` with `revertField` on error; three-view toggle; ▲▼
reorder via `swapItemInSection` + `swapItemOrderAction`; filter + sort overlay; grand/section
totals from `sectionSubtotalsForView`.

**Contract**: Port `git show poc-kosztorys-in-app:src/components/kosztorys/kosztorys-editor-v2.tsx`
and siblings. **Remove**: stage columns + `stagesKey` (no stages); brutto/VAT column + netto/
brutto toggle; `hidden_in_export` column + export/print step; add/remove-stage UI. **Keep**: the
remount `key` with `view` + `sort` on/off + `widthsKey`; the latest-rows ref pattern; `prevById`
sync; the section panel as control desk (add section [+ auto blank item], rename via panel only,
delete with cascade confirm, filter-to-section, "+ pozycja"); action column (▲▼ + trash). The
≥1-item invariant: block deleting a section's last item (event-time guard is acceptable for this
slice; disabled-with-tooltip is a later polish). Charts/columns follow the current Shadcn/table
conventions.

**Note (next/image)**: none expected here (data grid, no imagery). If any thumbnail is added,
set `sizes` to match rendered width.

#### 2. Add `react-datasheet-grid` dependency

**File**: `package.json`

**Intent**: Add the grid library (absent today).

**Contract**: Hand-edit `package.json` to add `react-datasheet-grid` (match the POC branch's
pinned version: `git show poc-kosztorys-in-app:package.json | grep datasheet`), then
`pnpm install`. Per project rule, prefer hand-editing over `pnpm add`; if the CSS build breaks
(lightningcss arch), repair with `pnpm install --force` + `rm -rf .next`.

#### 3. Port the dsg-remount lesson

**File**: `context/foundation/lessons.md`

**Intent**: The "every column-shaping dimension must be in the grid remount key" lesson exists
only on the POC branch. Port it forward so future editor work doesn't re-hit it.

**Contract**: Add a lesson entry: context (react-datasheet-grid freezes `columns` at mount),
problem (view/sort/width/hidden changes silently no-op), rule (bake every column-shaping
dimension into `key`; asc↔desc doesn't remount).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit suite green: `pnpm exec vitest run`
- Dev build compiles: `pnpm build` (or a clean `pnpm dev` start with no CSS/import error)

#### Manual Verification:

- On a test investment's Kosztorys tab: add a section (appears with one blank item); add/edit
  items inline; row/section/grand totals update live and match hand computation.
- Toggle the three price views → the price column + all totals recompute (not stuck on client
  price — confirms the remount key).
- ▲▼ reorder swaps neighbors within a section; no-op at block edges; disabled/greyed when a
  column sort is active.
- Edit a field, kill the network → the cell reverts (revert-on-error); a successful edit
  persists across `router.refresh()`.
- Deleting a section's last item is blocked; deleting a section cascades its items (with
  confirm).

**Implementation Note**: Pause for human confirmation of the manual editor checks before Phase 5.

---

## Phase 5: Wire into the investment page + verify

### Overview

Surface the editor on the investment detail page as a "Kosztorys" tab coexisting with the
existing "Arkusz" tab, gated to MANAGEMENT_ROLES, and run the end-to-end manual verification.

### Changes Required:

#### 1. Investment page tab

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx` (and/or the investment detail
tab host)

**Intent**: Render the new editor for the investment, fetching its tree server-side; keep the
"Arkusz" (sheet iframe) tab available. EMPLOYEE sees no kosztorys.

**Contract**: Server component fetches `getKosztorysTree(investmentId)` and renders
`KosztorysEditorV2`. Gate access with the same role check used by sibling kosztorys surfaces
(MANAGEMENT_ROLES; EMPLOYEE excluded). Add the tab alongside "Arkusz" without removing it
(coexistence until cutover, FR-016).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- As OWNER/MANAGER: open an investment → "Kosztorys" tab → author sections + items → live
  totals correct; reload preserves data.
- As EMPLOYEE: no kosztorys access.
- The "Arkusz" tab still renders for a sheet-backed investment; the mirror/sync is unaffected.
- Transfers/balances/marża for the same investment are unchanged (spot-check one figure before
  and after adding kosztorys data).

**Implementation Note**: Final human sign-off here closes the slice → run the slice-review gate.

---

## Testing Strategy

### Unit Tests (this slice):

- `calc.ts`: discount modes; view pricing (derived/coeff/amount overrides + section-over-global
  coeff); `sectionSubtotalsForView` sums + share.
- `v2-rows.ts`: `treeToRows` denormalization; `diffRow` change detection; `swapItemInSection` /
  `sectionNeighbor` (middle swap, edge no-op, appended-row tolerance); `sectionItemCount`.

### Integration / E2E:

- **Deferred to S-08** (editor E2E coverage) on the F-01 Playwright harness. Not in this slice.

### Manual Testing Steps:

1. Create a section → confirm one blank item appears.
2. Add items; edit pomiar/price/discount inline → totals recompute live.
3. Toggle price views → column + totals switch (remount-key check).
4. ▲▼ reorder within a section; verify edge no-ops and sort-disables-arrows.
5. Kill network mid-edit → cell reverts; successful edit survives refresh.
6. Delete last item of a section → blocked; delete section → cascades with confirm.
7. EMPLOYEE has no access; "Arkusz" tab + mirror still work; financial figures unchanged.

## Performance Considerations

The spreadsheet-parity bar is 1000+ rows. Two design choices carry the load: autosave persists
only the changed field (`diffRow`), and ▲▼ reorder is a 2-write swap (not an N-write
renumber) — both honor the "writes = real change" lesson. `sectionSubtotalsForView` is a single
O(rows) reduce per render; acceptable at this scale with React Compiler on. Watch the dsg
remount cost when toggling view/sort at large row counts during manual verification.

## Migration Notes

Additive only. `up` creates two tables + two investment columns (with safe defaults so existing
rows are valid); `down` reverses. Apply locally against docker 5433 via `pnpm payload migrate`.
Prod is applied by a human via `pnpm db:migrate:prod` **before** the code that needs it ships —
never by the agent (`payload-prod-migrate` skill). No data backfill required.

## References

- Change identity + scope decisions: `context/changes/kosztorys-sections-items/change.md`
- POC decision register: `context/changes/kosztorys-mvp/change.md`
- POC design + S-01 slice specs: `context/archive/kosztorys-poc-in-app/` (esp.
  `2026-06-19-kosztorys-poc-in-app-design.md`,
  `2026-06-20-kosztorys-add-remove-struktura-slice1-design.md`,
  `2026-06-20-kosztorys-reorder-items-slice2-design.md`)
- POC source to port: `git show poc-kosztorys-in-app:<path>`
- Conventions: `src/lib/actions/run-action.ts`, `src/collections/sheets.ts`, `src/lib/db/get-db.ts`,
  `src/lib/cache/tags.ts`, `src/lib/auth/roles.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + collections

#### Automated

- [x] 1.1 Migration applies cleanly on local docker (`pnpm payload migrate`)
- [x] 1.2 Types regenerate (`pnpm generate:types`)
- [x] 1.3 Type checking passes (`pnpm typecheck`)
- [x] 1.4 Lint passes (`pnpm lint`)

#### Manual

- [ ] 1.5 Both collections appear under "Kosztorys" admin group; section + item creatable
- [ ] 1.6 `investments` shows coefficient defaults (0.65 / 0.55)
- [ ] 1.7 No existing table changed except `investments`; sheet flow untouched

### Phase 2: Port the tested calc core

#### Automated

- [ ] 2.1 Calc + rows unit tests pass (`vitest run` on both specs)
- [ ] 2.2 Type checking passes

#### Manual

- [ ] 2.3 One worked example spot-checked by hand against test output

### Phase 3: Server actions + query

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Lint passes
- [ ] 3.3 Existing unit suite still green (`pnpm exec vitest run`)

#### Manual

- [ ] 3.4 `getKosztorysTree` returns ordered sections/items; add-section yields one blank item; swap changes 2 rows

### Phase 4: Editor UI

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Lint passes
- [ ] 4.3 Unit suite green
- [ ] 4.4 Dev build compiles / clean dev start (`pnpm build`)

#### Manual

- [ ] 4.5 Add section (auto blank item), inline-edit items, live totals correct
- [ ] 4.6 Three-view toggle recomputes column + totals (remount-key check)
- [ ] 4.7 ▲▼ reorder swaps neighbors; edge no-op; disabled under active sort
- [ ] 4.8 Revert-on-error works; successful edit survives refresh
- [ ] 4.9 Last-item delete blocked; section delete cascades with confirm

### Phase 5: Wire into the investment page + verify

#### Automated

- [ ] 5.1 Type checking passes
- [ ] 5.2 Lint passes
- [ ] 5.3 Build passes (`pnpm build`)

#### Manual

- [ ] 5.4 OWNER/MANAGER author flow end-to-end; reload preserves data
- [ ] 5.5 EMPLOYEE has no kosztorys access
- [ ] 5.6 "Arkusz" tab + mirror still work for sheet-backed investment
- [ ] 5.7 Transfers/balances/marża unchanged (spot-check before/after)
