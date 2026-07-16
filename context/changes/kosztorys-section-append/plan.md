# Kosztorys Section Append Implementation Plan

## Overview

Add „Dodaj sekcję z szablonu": a searchable multi-select picker over all sections across all saved szablony (presets), appending the chosen sections — with their prace, ceny, and coefficients — into the current kosztorys. Reachable from the toolbar „Dodaj" menu and from the empty-kosztorys dialog. This closes the granularity gap between whole-szablon seeding (S-09, empty target only) and the deferred single-praca autocomplete (EX-434).

## Current State Analysis

- **Preset storage** (`kosztorys_presets`): one row per szablon, payload is snapshot-shaped (`SnapshotPayloadT`, `src/lib/kosztorys/snapshot-format.ts:27` — flat `sections[]` + `items[]` + `stages[]` + `progress[]` + `settings`). Job-specific item fields are already zeroed at **serialize** time (`serializeKosztorysAsPreset`, `src/lib/kosztorys/serialize-preset.ts:14-21`): `plannedQty: 0`, `discountType: null`, `discountValue: 0`, `hiddenInExport: false`, `note: null`; `progress: []`.
- **Read paths**: `listPresets` (`src/lib/db/presets.ts:76`) returns metadata only — the picker must never ship full payloads to the client; `getPreset(id)` (`:64`) is the single full-payload read, server-side, cast without runtime validation (known debt EX-439 — inherited, not worsened here).
- **Apply engine**: `applyPreset` (`src/lib/kosztorys/apply-preset.ts`) bulk-inserts the full tree with old→new id remap, assuming an empty target. A section append needs only its sections+items portion — no stages (investment-level), no progress (empty in presets), no settings.
- **display_order**: manual add-section uses `MAX(display_order)+1` (`addSectionAction`, `src/lib/actions/kosztorys.ts:157-160`). Gaps are harmless; order is relative.
- **Section names**: no uniqueness constraint anywhere (`src/collections/kosztorys-sections.ts:31`) — a second „Łazienka" in one kosztorys is fine.
- **UI surfaces**: `KosztorysAddMenu` (`src/components/kosztorys/kosztorys-add-menu.tsx`) — shadcn DropdownMenu with three inline actions (Praca/Etap/Sekcja). Preset dialogs (`seed-from-preset-button.tsx`, `save-as-dialog.tsx`) fetch lists lazily via server action on open, use `toastMessage` + pending-state disable. `empty-kosztorys-dialog.tsx` blocks an empty kosztorys until a blank section or full-szablon seed (EX-463 stopgap). cmdk primitives exist at `src/components/ui/command.tsx`.
- **Refresh reality** (lesson + EX-441): grid rows live in mount-time `useState` (`use-kosztorys-editor.ts:106`); `router.refresh()` does **not** re-seed them. The existing seed path relies on the `becamePopulated` remount (`kosztorys-editor-v2.tsx:44-51`), which only fires on the empty→populated transition. Optimistic structural adds go through `setRows` (`handleAddSection`, `use-kosztorys-editor.ts:346-371`).
- **RBAC**: page + actions + collections are already Manager+ (`MANAGEMENT_ROLES`); nothing extra needed.
- **No migration**: no schema change of any kind.

## Desired End State

A Manager+ user in the kosztorys editor opens „Dodaj" → „Sekcja z szablonu…", searches/browses a flat list of all sections grouped under their source szablon headers, checks any number of them (across szablony), confirms once, and the sections appear at the end of the kosztorys with all prace, ceny j.m., and coefficients — przedmiary at zero. The same picker is offered on an empty kosztorys by the blocking dialog, enabling à-la-carte composition without a throwaway blank section.

Verify: integration tests green, then in the browser — append two sections from two different szablony into a non-empty kosztorys without a page reload; compose an empty kosztorys purely from picked sections.

### Key Discoveries:

- Preset payloads are already job-field-clean — the append inserts values verbatim, no stripping step (`serialize-preset.ts:14-21`).
- The append is NOT a third fork of the apply/restore engine (EX-438): it inserts only sections+items with a displayOrder offset — a small focused helper, not the full FK-ordered tree.
- Seed-from-preset's transaction pattern (`seed-from-preset.ts:27-47`: `payload.db.beginTransaction()`, `req` with `transactionID` + `context.skipRevalidation`, rollback on throw) is the template; its copy-paste status is EX-440 — do not make it worse: reuse the exact same shape, extraction stays with EX-440.
- Test template: `src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts` — real-DB integration (5435 via `pnpm test:integration`, `describe.skipIf(!ENV_READY)`), `next/cache` mocked, asserts persisted state by re-reading, cleanup in `afterAll`.

## What We're NOT Doing

- No seed-dialog section multi-select rework of the _full-szablon_ seed path — `seedFromPresetAction` and its empty-guard stay untouched.
- No write-side changes: no „zapisz sekcję do szablonu", no canonical/unique section names, no preset schema change (rejected during shaping — the conflict-resolution ceremony it forces is "bad").
- No stages/progress/settings handling in the append — structurally excluded.
- No fix for EX-438/EX-439/EX-440/EX-441 — inherited debt stays filed; this change must not add a new copy of the full tree-insert engine.
- No Playwright E2E authored in this plan — owed at the slice-review gate (author there or file to the `e2e-backlog` Linear issue per AGENTS.md).

## Implementation Approach

Two phases: server core first (section-meta listing + transactional append action + integration tests), then UI (cmdk picker dialog wired into both entry points, optimistic grid patch). The action returns the created tree slice so the non-empty editor can patch rows locally instead of relying on a refresh that cannot work.

## Critical Implementation Details

- **Grid refresh**: after a successful append into a **non-empty** kosztorys, patch `rows` (and `prevById`) from the action's returned slice via `setRows` — `router.refresh()` alone will not update the grid (mount-frozen `useState`, EX-441). Still call `router.refresh()` for the sidepanel/progress surfaces that read the `tree` prop. On an **empty** kosztorys (picker used from the blocking dialog), reuse the existing `handleRestored` path (`router.refresh()` + `becamePopulated` remount) — do not build a second mechanism.
- **Never fire the server action inside a `setRows` updater** (lessons.md) — call it from the event handler, apply the optimistic patch after the action resolves with the real new ids (no temp-id reconciliation needed).
- **displayOrder collision under concurrency** is accepted, same as S-09's empty-guard race: two concurrent appends may compute the same `MAX+1`; duplicate `display_order` values only make relative order ambiguous, nothing corrupts. Document in the action docstring, don't engineer around it.

## Phase 1: Server core — section listing + append action

### Overview

Everything the picker needs from the server: a slim cross-preset section listing, and a transactional append that inserts chosen sections+items and returns the created slice.

### Changes Required:

#### 1. Section-meta listing

**File**: `src/lib/db/presets.ts`

**Intent**: List every section across all presets with just enough metadata for the picker — never shipping items to the client.

**Contract**: `listPresetSections(): Promise<PresetSectionMetaT[]>` where `PresetSectionMetaT = { presetId: number; presetName: string; sectionId: number; sectionName: string; itemCount: number }`. Implementation reads `id, name, payload` rows and maps in TS server-side (few presets; server-side payload reads are fine — the "no full tree" rule is about the client wire). Order: by preset `created_at DESC` (matching `listPresets`), sections by `displayOrder` within each.

**File**: `src/lib/queries/presets.ts`

**Intent**: Cached wrapper following `getPresets`.

**Contract**: `getPresetSections()` via `unstable_cache`, tag `CACHE_TAGS.presets` (same single-writer invalidation — `savePresetAction`).

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: Expose the listing to the client dialogs (fetch-on-open pattern).

**Contract**: `listPresetSectionsAction(): Promise<ActionResultT<PresetSectionMetaT[]>>` via `protectedAction`, no revalidation tags.

#### 2. Append helper

**File**: `src/lib/kosztorys/append-preset-sections.ts` (new)

**Intent**: Insert the chosen sections and their items into a (possibly non-empty) kosztorys inside the caller's transaction. Deliberately NOT a fork of `applyPreset` — sections+items only, with a displayOrder offset.

**Contract**: `appendPresetSections(payload, req, investmentId, slices: { section: KosztorysSectionT; items: KosztorysItemT[] }[]): Promise<AppendedSliceT>` — computes `MAX(display_order)+1` base within the transaction, inserts sections then items (bulk `INSERT … RETURNING id`, same VALUES-order remap guarantee as `apply-preset.ts:34-40`), returns the created slice with **new** ids in the same nested shape `getKosztorysTree` produces for those sections (so the client can build rows without a refetch).

#### 3. Append action

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: The mutation the picker confirms — resolve selections to payload slices, validate, run the append transactionally.

**Contract**: `appendPresetSectionsAction(investmentId: number, selections: { presetId: number; sectionId: number }[])` via `protectedAction`. Zod: non-empty selections. Group by `presetId`, `getPreset` each involved preset once; a missing preset or a `sectionId` absent from its payload → Polish error, nothing written. Transaction shape copied verbatim from `seed-from-preset.ts:27-47` (EX-440 stays as-is). Success returns the created slice. Revalidation tags: `['kosztorysSections', 'kosztorysItems']`.

#### 4. Integration tests

**File**: `src/__tests__/lib/kosztorys/append-preset-sections.test.ts` (new)

**Intent**: Pin persisted behavior at the same layer as the S-09 tests.

**Contract**: mirror `serialize-apply-preset.test.ts` harness (real DB, `skipIf(!ENV_READY)`, `next/cache` mocked, cleanup). Specs: (a) append one section into a **non-empty** kosztorys — persisted tree keeps existing sections first, appended section last with correct prace/ceny/coefficients and zeroed job fields; (b) one call appending two sections from two **different** presets; (c) append into an **empty** kosztorys works (no empty-guard); (d) unknown `sectionId` → error result and **nothing persisted** (rollback proven by re-read); (e) appending a section whose name already exists in the target succeeds (duplicate names allowed).

### Success Criteria:

#### Automated Verification:

- New integration tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/append-preset-sections.test.ts`
- Existing preset tests still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`
- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- (none — server-only phase; browser checks land in Phase 2)

---

## Phase 2: UI — picker dialog + entry points + grid patch

### Overview

The cmdk picker dialog, wired into the „Dodaj" menu and the empty-kosztorys dialog, with the optimistic grid update for the non-empty case.

### Changes Required:

#### 1. Picker dialog

**File**: `src/components/kosztorys/add-sections-from-preset-dialog.tsx` (new)

**Intent**: Searchable multi-select over all preset sections; one confirm appends everything chosen.

**Contract**: shadcn `Dialog` + `Command` (`src/components/ui/command.tsx`). Fetch-on-open via `listPresetSectionsAction()` (pattern: `seed-from-preset-button.tsx:29-30`). `CommandGroup` per szablon (heading = preset name), `CommandItem` = section name + item count, toggles membership in a selected `Set` (item `onSelect` toggles — the dialog stays open; multi-select is why this is not a popover combobox). Footer: „Dodaj (n)" disabled when `n === 0` or pending; empty-state text when no presets exist. On confirm: `appendPresetSectionsAction`, toasts via `toastMessage`, then `onAppended(slice)`. Polish UI strings, English code.

#### 2. „Dodaj" menu entry

**File**: `src/components/kosztorys/kosztorys-add-menu.tsx`

**Intent**: Fourth item „Sekcja z szablonu…" opening the dialog.

**Contract**: `DropdownMenuItem` that opens the controlled dialog — dialog state must live **outside** the dropdown content (the menu unmounts on close); render the dialog as a sibling, the item only sets `open`.

#### 3. Empty-kosztorys dialog entry

**File**: `src/components/kosztorys/empty-kosztorys-dialog.tsx`

**Intent**: Third option alongside blank-section and full-szablon seed, so à-la-carte composition needs no throwaway section.

**Contract**: embed the picker (same component); on success route through the existing `onCreated`/`handleRestored` path (`kosztorys-editor-v2.tsx:60-63`) — the `becamePopulated` remount picks up the fresh tree.

#### 4. Grid patch for the non-empty case

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (or the editor context — implementer picks the seam `handleAddSection` uses)

**Intent**: Append the returned slice to the grid without a reload.

**Contract**: `handleAppendedSections(slice)` — build rows from the slice (align with `treeToRows` / `buildBlankRow` conventions in `src/lib/kosztorys/v2-rows.ts`), `setRows` append + `prevById` registration, then `router.refresh()` for prop-reading surfaces (sidepanel, progress counter). Action already resolved — no temp ids, no reconciliation.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Unit/integration suites still pass: `pnpm test`

#### Manual Verification:

- Non-empty kosztorys: „Dodaj" → „Sekcja z szablonu…" → check two sections from two different szablony → both appear at the end of the grid with prace, ceny and coefficients, przedmiary 0 — without a page reload; sidepanel section list shows them.
- Empty kosztorys: blocking dialog offers the picker; composing from two picked sections lands the populated editor (remount path) with no blank-section litter.
- Search in the picker filters across all szablony; group headers show the source szablon; item counts are correct.
- Duplicate case: appending „Łazienka" into a kosztorys that already has „Łazienka" yields two sections, both editable.
- Error case: no szablony saved → picker shows the empty-state message, confirm disabled.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None planned — the logic worth testing is DB-transactional; unit-mocking it would test the mock (see integration).

### Integration Tests:

- `append-preset-sections.test.ts` (Phase 1, specs a–e above) — the persisted-state layer, matching the S-09 precedent.

### Manual Testing Steps:

1. Seed local dev with `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`, save the kosztorys as a szablon, save a second variant under another name.
2. Run the Phase 2 manual checks above against both a populated and a fresh investment.

### E2E:

- Browser-level slice → owes a Playwright spec per AGENTS.md; author at the slice-review gate or file to the `e2e-backlog` Linear issue. Not in this plan's phases.

## Performance Considerations

- `listPresetSections` reads all preset payloads server-side per cache miss; with a handful of presets (each ≤ a few hundred KB jsonb) this is trivial, and `unstable_cache` + single-writer invalidation makes it a one-time cost per preset save.
- The append bulk-insert inherits the single-statement param ceiling noted in EX-438 (~3.8k items); a picked section is dozens of items — no chunking needed here, and chunking stays with EX-438's shared-helper work.

## Migration Notes

None — no schema change. Kosztorys data is throwaway until dogfooding merges (AGENTS.md), so no data-preservation concerns of any kind.

## References

- Change identity + shaping decisions: `context/changes/kosztorys-section-append/change.md`
- S-09 archive (engine + decisions): `context/archive/2026-07-11-kosztorys-preset/`
- Apply engine: `src/lib/kosztorys/apply-preset.ts`; seed transaction template: `src/lib/kosztorys/seed-from-preset.ts:27-47`
- Test template: `src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`
- Refresh trap: lessons.md „Denormalized fields changed from outside the grid…" + EX-441

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server core — section listing + append action

#### Automated

- [x] 1.1 New integration tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/append-preset-sections.test.ts` — 8be1d07
- [x] 1.2 Existing preset tests still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts` — 8be1d07
- [x] 1.3 Type checking passes: `pnpm exec tsc --noEmit` — 8be1d07
- [x] 1.4 Linting passes: `pnpm lint` — 8be1d07

### Phase 2: UI — picker dialog + entry points + grid patch

#### Automated

- [x] 2.1 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 2.2 Linting passes: `pnpm lint`
- [x] 2.3 Unit/integration suites still pass: `pnpm test`
