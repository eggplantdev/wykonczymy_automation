# Remove Per-Section Subcontractor Coeff Implementation Plan

## Overview

Remove the **per-section** subcontractor markup coeff tier (`wToolsCoeff` / `ownToolsCoeff` on
`kosztorys_sections`) and every layer that reads, writes, edits, undoes, serializes, or persists it,
collapsing `effectiveCoeff` to **global-only** (investment tier → per-item override still stand). In
the same change, replace the icon-only add-item / delete-section buttons in the section sidebar with
explicit **inline icon+label** buttons „Dodaj pozycję do sekcji" / „Usuń sekcję", and remove the
section coeff popover that sat beside them.

## Current State Analysis

Subcontractor price today derives from a three-tier coeff: **investment (global) → section →
per-item override** (`calc.ts:38-50`). `effectiveCoeff(row, view)` reads `sectionWToolsCoeff ??
globalWToolsCoeff`. The section tier is edited via a `SlidersHorizontal` popover in the section
sidebar (`kosztorys-section-summary.tsx:130-168`), persisted in two nullable `numeric` columns on
`kosztorys_sections`, denormalized onto every v2 row, carried through undo/redo, serialization,
snapshots, and preset append. `null` on a section means "inherit the global one".

The **global** tier (columns on `investments`, the shared `CoeffField` in the settings row,
`SnapshotSettingsT.wToolsCoeff/ownToolsCoeff`, `inverseGlobalCoeffPatch`) and the **per-item
override** tier are unaffected and must stay. Note the section and investment columns share the
names `w_tools_coeff` / `own_tools_coeff` — the migration drops them from `kosztorys_sections`
**only**.

### Key Discoveries:

- **No dedicated `applySectionCoeff` server action** — the client rides the shared
  `updateSectionFieldAction` via `sectionPatchSchema` (`src/lib/actions/kosztorys.ts:40-48`); only the
  two coeff fields drop from that schema, the action and its other fields stay.
- **`use-undo-redo.ts` has no section-specific code** — it's a generic command stack. Section-coeff
  undo lives entirely in `inverseSectionCoeffPatch` (`v2-rows.ts:101-111`) fed through the generic
  `pushReversible` helper (`use-kosztorys-editor.ts:246`).
- **Serialization rides the whole section object** (`serialize-kosztorys.ts:12` spreads
  `{ items, ...section }`), so dropping the type field removes it from serialized output and snapshots
  automatically — no serializer edit needed beyond the type.
- **`CoeffField`'s `nullable` variant is section-only** — global callers pass required values. Once the
  section popover goes, `nullable` is dead and is removed (gated on typecheck).
- **Sites `change.md` missed:** `row-ops.ts:29-30,62-63`; `seed-investment-from-sheet.ts:135-136,
234-235`; `use-kosztorys-editor.ts` denorm sites `:517-518,551-552,655-656`; test
  `kosztorys-calc.test.ts:34-35`; `payload-types.ts` (regenerated, never `git add`).
- **Kosztorys data is throwaway pre-dogfooding** (AGENTS.md) — the migration drops columns with **no
  backfill / no compat shim**.

## Desired End State

`effectiveCoeff` reads global-only; no code path references `sectionWToolsCoeff` / `sectionOwnToolsCoeff`
or the section coeff columns. The section sidebar shows, per section, two inline icon+label buttons
(add-item / delete-section) and no coeff popover. `pnpm typecheck`, `pnpm lint`, and the kosztorys
Vitest suite are green; `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch\|applySectionCoeff\|handleSectionCoeffChange"
src/` returns nothing. The drop-column migration applies cleanly against the local docker DB.

## What We're NOT Doing

- **Not** touching the global coeff (investments columns, settings-row `CoeffField`, `SnapshotSettingsT`,
  `inverseGlobalCoeffPatch`, `updateInvestmentCoeffsAction`) or the per-item override tier.
- **Not** writing a data backfill, compat shim, or two-step migration (throwaway data).
- **Not** running the prod migration in this task — a human runs `pnpm db:migrate:prod` at ship time
  (see Migration Notes).
- **Not** changing the delete-section confirm dialog behavior or the „Nowa sekcja" footer button.
- **Not** restyling the sidebar beyond the two buttons and the removed popover.

## Implementation Approach

Removing a field from `KosztorysSectionT` / the v2 row type is an **atomic typecheck unit** — every
reader breaks until all are updated, so a green `pnpm typecheck` is asserted at the **end of Phase 3**,
not per-phase. Phases 1–3 organize the work in dependency order (schema → domain → editor/UI) but land
as one coherent removal; Phase 4 updates tests/fixtures and regenerates types for the final green gate.
Work bottom-up: DB/collection first, then the domain calc/serialization layer, then editor state and UI.

## Phase 1: Schema & Collection

### Overview

Drop the two section coeff columns and remove the collection field definitions.

### Changes Required:

#### 1. Drop-column migration

**File**: `src/migrations/20260724_1_drop_kosztorys_section_coeff.ts` (new)

**Intent**: Hand-written migration (per AGENTS.md — `migrate:create` snapshots are stale) that drops
`w_tools_coeff` / `own_tools_coeff` from `kosztorys_sections`. No backfill.

**Contract**: Mirror the structure of `20260721_1_add_vat_plane_to_transactions.ts`. `up` →
`ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "w_tools_coeff"` / `"own_tools_coeff"`. `down`
→ re-add both as nullable `numeric` (matching the original `20260708_2` definition). Touch the
`kosztorys_sections` table **only** — the identically-named `investments` columns are the global tier
and stay.

#### 2. Collection field removal

**File**: `src/collections/kosztorys-sections.ts`

**Intent**: Delete the `wToolsCoeff` / `ownToolsCoeff` field definitions and their "inherit the global
one" comment.

**Contract**: Remove `kosztorys-sections.ts:40-51`. Keep `name`, `displayOrder`, `defaultCostVariant`.

### Success Criteria:

#### Automated Verification:

- Migration applies against local docker DB: `pnpm payload migrate` (or the project's migrate command)
- Down migration reverts cleanly (spot check)

#### Manual Verification:

- App still boots against the local DB with the columns gone

---

## Phase 2: Domain Layer (types, calc, serialization, presets, queries, action schema)

### Overview

Remove the section coeff from types, collapse `effectiveCoeff` to global-only, and strip it from every
domain read/write path.

### Changes Required:

#### 1. Types

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Drop the section coeff from the section type and both denormalized row-type sites.

**Contract**: Remove `wToolsCoeff`/`ownToolsCoeff` from `KosztorysSectionT` (`:30-32`) and
`sectionWToolsCoeff`/`sectionOwnToolsCoeff` from `ViewPricingT` (`:85-86`) and `KosztorysV2RowBaseT`
(`:155-156`). Keep the global fields (`globalWToolsCoeff` etc.) and `KosztorysGlobalCoeffsT`.

#### 2. Calc

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: `effectiveCoeff` returns the global coeff directly — no section fallback.

**Contract**: `calc.ts:38-42` — replace `sectionWToolsCoeff ?? globalWToolsCoeff` with
`globalWToolsCoeff` (same for ownTools). `subcontractorPrice` (`:50`) is unchanged.

#### 3. v2-rows: denorm + patch + inverse

**File**: `src/lib/kosztorys/v2-rows.ts`

**Intent**: Stop denormalizing section coeff onto rows; delete the section patch type and its inverse.

**Contract**: Remove the `sectionWToolsCoeff`/`sectionOwnToolsCoeff` assignments (`:44-45`), the
`SectionCoeffPatchT` type (`:85`), and `inverseSectionCoeffPatch` (`:101-111`). Keep `CoeffPatchT`
and `inverseGlobalCoeffPatch` (`:84,91-99`).

#### 4. row-ops, insert-rows, append-preset-sections, queries, seed

**Files**: `src/lib/kosztorys/row-ops.ts` (`:29-30,62-63`), `src/lib/kosztorys/insert-rows.ts`
(`:36-44`), `src/lib/kosztorys/append-preset-sections.ts` (`:57-58`),
`src/lib/queries/kosztorys.ts` (`:119-120`), `src/scripts/seed-investment-from-sheet.ts`
(`:135-136,234-235`)

**Intent**: Remove every read/write of the section coeff — the row-op denorm, the SQL column
list/VALUES in `insertSections`, the preset-append carry, the query mapping, and the seed writes.

**Contract**: In `insert-rows.ts` drop `w_tools_coeff, own_tools_coeff` from both the column list and
the `VALUES` tuple. In `queries/kosztorys.ts` keep the global mapping at `:78-80`. In the seed, keep
the global write at `:190-191`.

#### 5. Action schema

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Remove the two coeff fields from the section patch schema; the action itself stays.

**Contract**: Delete `wToolsCoeff`/`ownToolsCoeff` from `sectionPatchSchema` (`:45-46`). Keep
`updateSectionFieldAction`, `SectionPatchT`, and the separate `investmentCoeffsSchema` /
`updateInvestmentCoeffsAction` (global — untouched).

### Success Criteria:

#### Automated Verification:

- No section-coeff domain symbols remain: `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch" src/lib src/scripts` is empty

#### Manual Verification:

- (Deferred to Phase 3 — typecheck is not green until the editor/UI readers are updated)

---

## Phase 3: Editor State & UI

### Overview

Remove section-coeff state, handlers, and undo wiring from the editor hook and its prop chain; remove
the coeff popover; relabel the sidebar buttons; delete the dead `CoeffField` `nullable` variant. Green
`pnpm typecheck` is asserted here.

### Changes Required:

#### 1. Editor hook

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Delete all section-coeff state, the optimistic apply, the change handler with its undo
wiring, the row denorm sites, and the `inverseSectionCoeffPatch` import + hook returns.

**Contract**: Remove the `inverseSectionCoeffPatch` import (`:26`), the `sectionCoeffs` map
(`:399-400`), the `sectionWToolsCoeff`/`sectionOwnToolsCoeff` denorm at the `patchRows` sites
(`:517-518,551-552,655-656`), `applySectionCoeff` (`:945-972`), `handleSectionCoeffChange`
(`:974-987`), and the `sectionCoeffs` / `handleSectionCoeffChange` returns (`:1094,1117`). Keep the
global counterparts (`applyGlobalCoeff` `:849-876`, `handleGlobalCoeffChange` `:878-882`) and the
generic `pushReversible` helper.

#### 2. Prop chain

**File**: `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Stop destructuring and threading the removed section-coeff props.

**Contract**: Remove `sectionCoeffs` (`:81`) and `handleSectionCoeffChange` (`:89`) destructures and
the `sectionCoeffs` / `onSectionCoeffChange` props passed to `<KosztorysSectionSummary>`
(`:201,207`). Keep `globalCoeffs` if `KosztorysSectionSummary` still needs it (see below).

#### 3. Section sidebar — remove popover, relabel buttons

**File**: `src/components/kosztorys/kosztorys-section-summary.tsx`

**Intent**: Delete the coeff popover and its props; render the add-item and delete-section actions as
inline **icon + label** buttons in the same per-section actions row.

**Contract**: Remove the `SectionCoeffsT` type (`:15`), the `sectionCoeffs` (`:22`) and
`onSectionCoeffChange` (`:28-31`) props, the `CoeffField` import, and the entire `Popover` block
(`:130-168`) including its `SlidersHorizontal` trigger. Replace the icon-only add-item (`:169-176`)
and delete (`:177-184`) buttons with inline buttons that show `<Plus/>` + „Dodaj pozycję do sekcji"
and `<Trash2/>` + „Usuń sekcję" respectively, keeping the existing `onAddItem` / `confirmRemove`
handlers, the `hover:text-destructive` accent on delete, and the `ConfirmDialog`. If `globalCoeffs`
becomes unused after the popover removal, drop that prop too (and its pass-down in editor-body). Drop
now-unused lucide imports (`SlidersHorizontal`).

**Contract note (layout)**: the labels are long for a `w-72` sidebar — the user accepted the inline
tradeoff. Use a compact text size and allow the row to wrap (`flex-wrap`) so the second button drops to
a new line rather than truncating illegibly.

#### 4. Remove dead `nullable` CoeffField variant

**File**: `src/components/kosztorys/coeff-field.tsx`

**Intent**: The section popover was the only `nullable` caller; strip the prop and its branch.

**Contract**: Remove the `nullable` prop and any `null`-specific rendering/commit branch, gated on
`pnpm typecheck` confirming no remaining caller. If typecheck flags a surviving caller, leave the
variant and record why.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- No section-coeff symbols anywhere: `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch\|applySectionCoeff\|handleSectionCoeffChange\|onSectionCoeffChange" src/` is empty

#### Manual Verification:

- Section sidebar shows the two labeled buttons per section; „Dodaj pozycję do sekcji" adds an item to
  that section, „Usuń sekcję" opens the confirm dialog and deletes on confirm
- No coeff popover / `SlidersHorizontal` trigger remains
- Subcontractor prices in the grid now reflect the global coeff (and per-item overrides) with no section
  influence — spot-check a section that previously had a section coeff set

---

## Phase 4: Tests, Fixtures & Type Regen

### Overview

Update/trim the specs and fixtures that reference section coeff, regenerate Payload types, and land the
final green suite.

### Changes Required:

#### 1. Tests — partial updates

**Files**: `src/__tests__/lib/kosztorys/inverse-coeff-patch.test.ts`,
`serialize-restore-roundtrip.test.ts`, `serialize-apply-preset.test.ts`, `append-preset-sections.test.ts`,
`reconciliation.test.ts`, `kosztorys-settlement.test.ts`, `kosztorys-v2-rows.test.ts`,
`kosztorys-sort-value.test.ts`, `kosztorys-calc.test.ts`

**Intent**: Remove section-coeff fixture fields and the section-specific assertions/blocks; keep every
global-coeff case.

**Contract**: In `inverse-coeff-patch.test.ts` delete the `inverseSectionCoeffPatch` import and its
entire `describe` block (`:35-57`); keep the `inverseGlobalCoeffPatch` block. In
`append-preset-sections.test.ts` remove the `expect(appended.wToolsCoeff).toBe(0.8)` assertion
(`:131`) and the section-create coeff data (`:57-58`); keep the item-level override cases. In the
remaining files, strip only the section-coeff fixture lines (per-file line refs in `research`/blast
radius) — the roundtrip/preset assertions pass unchanged once the serialized shape drops the fields.
`snapshots.test.ts` (`:21-22`) is the **global** snapshot settings block — no change.

#### 2. Fixture

**File**: `src/scripts/fixtures/kosztorys-bialostocka.json`

**Intent**: Remove the null `wToolsCoeff`/`ownToolsCoeff` from all 13 section objects; keep the
top-level `settings` global coeffs.

**Contract**: Delete the two keys from each object in the `sections` array (lines listed in blast
radius); leave the `settings` block at `:6618-6619` intact.

#### 3. Regenerate Payload types

**File**: `src/payload-types.ts` (generated)

**Intent**: Regenerate so the section type no longer carries the coeff fields.

**Contract**: `pnpm generate:types`. **Never `git add`** this file — it is gitignored.

### Success Criteria:

#### Automated Verification:

- Kosztorys suite passes: `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/lib/db/snapshots.test.ts`
- Full typecheck + lint still green: `pnpm typecheck && pnpm lint`
- Repo-wide grep clean: `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch\|applySectionCoeff\|\.wToolsCoeff\b" src/lib/kosztorys src/components/kosztorys` shows only global usages

#### Manual Verification:

- Full local smoke of the kosztorys editor: add item / delete section / snapshot / apply preset all work
  with no section-coeff residue

**Implementation Note**: After each phase's automated verification passes, pause for the human to confirm
manual testing before proceeding. Manual items are aggregated into `context/foundation/manual-checks.md`
at the final phase.

---

## Testing Strategy

### Unit Tests:

- Existing kosztorys specs, trimmed of section-coeff cases, remain the regression guard for calc,
  serialization, preset append, reconciliation, settlement, and sort-value.
- No new test is owed for a pure removal; the surviving `effectiveCoeff` behavior is already covered by
  `kosztorys-calc.test.ts` global-coeff cases.

### Integration Tests:

- `snapshots.test.ts` (DB) continues to assert the global snapshot settings shape unchanged.

### Manual Testing Steps:

1. Open a kosztorys with sections; confirm each section shows the two labeled buttons and no coeff popover.
2. „Dodaj pozycję do sekcji" adds a row to the correct section; „Usuń sekcję" confirms then deletes.
3. On a section that previously carried a section coeff, verify subcontractor prices now follow the global
   coeff / per-item overrides only.
4. Take a snapshot and apply a preset — no errors, no section-coeff residue.

## Performance Considerations

None — this is a removal; it slightly shrinks row payloads and the sections query.

## Migration Notes

- **Local**: apply `20260724_1_drop_kosztorys_section_coeff.ts` against the docker DB during Phase 1.
- **Prod**: a `.husky/pre-push` gate reminds on a `main` push that adds `src/migrations/*.ts`. A **human**
  runs `pnpm db:migrate:prod` **before** pushing the code that needs it. The agent never runs the prod
  migration. This is deploy-time only — writing the migration and the local reader is one continuous local
  task; do not mark a phase "blocked on prod".
- **No data preservation** — kosztorys rows are throwaway pre-dogfooding (AGENTS.md); dropping the columns
  discards nothing that matters.

## References

- Change identity + blast radius: `context/changes/remove-section-coeff/change.md`
- Migration structure to mirror: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts`
- Original section-coeff migration (for the `down` re-add shape): `src/migrations/20260708_2_add_kosztorys_sections_items.ts:16-17,51-52`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Collection

#### Automated

- [x] 1.1 Migration applies against local docker DB: `pnpm payload migrate`
- [x] 1.2 Down migration reverts cleanly (spot check)

### Phase 2: Domain Layer

#### Automated

- [ ] 2.1 No section-coeff domain symbols remain: `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch" src/lib src/scripts` is empty

### Phase 3: Editor State & UI

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Linting passes: `pnpm lint`
- [ ] 3.3 No section-coeff symbols anywhere: `grep -rn "sectionWToolsCoeff\|sectionOwnToolsCoeff\|SectionCoeffPatch\|applySectionCoeff\|handleSectionCoeffChange\|onSectionCoeffChange" src/` is empty

### Phase 4: Tests, Fixtures & Type Regen

#### Automated

- [ ] 4.1 Kosztorys suite passes: `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/lib/db/snapshots.test.ts`
- [ ] 4.2 Full typecheck + lint still green: `pnpm typecheck && pnpm lint`
- [ ] 4.3 Repo-wide grep clean (only global usages remain)
