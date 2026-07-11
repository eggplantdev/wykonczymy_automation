---
date: 2026-07-11T09:13:21Z
researcher: ex-Plant
git_commit: 83729ea30696ff6b69563591d42fb4e1e4593d1d
branch: main
repository: wykonczymy
topic: "S-09 kosztorys-preset — presets/templates + autocomplete over preset prace"
tags: [research, codebase, kosztorys, preset, snapshots, serialize, autocomplete]
status: complete
last_updated: 2026-07-11
last_updated_by: ex-Plant
---

# Research: S-09 kosztorys-preset — presets/templates + autocomplete

**Date**: 2026-07-11T09:13:21Z
**Researcher**: ex-Plant
**Git Commit**: 83729ea30696ff6b69563591d42fb4e1e4593d1d
**Branch**: main
**Repository**: wykonczymy

## Research Question

Research the ground for S-09 (`kosztorys-preset`): seed a new kosztorys from a preset, save an
existing kosztorys as a preset, and autocomplete over preset prace. Map the editor schema
(sections/items/stages/stage_progress), the calc/derivation layer, the server actions that build a
kosztorys, the legacy Google Sheets template seeding (`KOSZTORYS_TEMPLATE_SHEET_ID`), and how S-06
snapshots serialize/restore the tree — since a preset is a stripped-down serialized kosztorys.

## Summary

**A preset is structurally a snapshot payload minus the job-specific fields, applied to a *different*
investment.** The S-06 snapshot subsystem already implements ~80% of the machinery:
`SnapshotPayloadT` (the flat serialized tree), `serializeKosztorys` (read → flat payload), and the
bulk-insert + index-based id-remap engine in `restoreKosztorys` (apply a flat tree to an investment).
The preset work is mostly **fork-and-strip** of that path, plus **two genuinely new pieces**:

1. **A global-scoped storage** for presets. Every kosztorys entity today is `investment`-scoped
   (`required` relationship). Presets are the **first** cross-investment/global kosztorys concept —
   they need a new table with its own lifecycle (NOT the investment-scoped, GC'd `kosztorys_snapshots`).
2. **An autocomplete cell** on the grid's `description` column. Today it is a plain `textColumn`
   (free text); the repo has **no async/remote-search combobox pattern** — only in-memory
   `FormCombobox` fed a preloaded list. A custom dsg cell component (like the existing
   `subcontractorPriceColumn`) is the template.

The legacy behaviour being restored: `createSheetFromTemplate` did a **whole-spreadsheet Drive copy**
of `KOSZTORYS_TEMPLATE_SHEET_ID` — a pre-built master carrying all sections/rows/formulas. The app
wrote nothing structural; the structure lived in the template file. S-09 moves that "start from a
skeleton" behaviour in-app.

The load-bearing **keep-vs-reset** field split (what a preset carries vs zeroes) is fully mapped below.

## Detailed Findings

### Schema — the four kosztorys tables + investment settings

Collections (`src/collections/`):

- **`kosztorys-sections`** (`kosztorys-sections.ts:29-51`): `investment` (req), `name`,
  `displayOrder`, `defaultCostVariant` (default `'w_tools'`), `wToolsCoeff` (nullable = inherit
  global), `ownToolsCoeff` (nullable).
- **`kosztorys-items`** (`kosztorys-items.ts:31-49`): `investment` (req), `section` (req FK),
  `displayOrder`, `description` (prace opis), `unit` (J.m.), `plannedQty` (przedmiar), `measuredQty`
  (pomiar), `discountType` (`percent|amount|null`), `discountValue`, `clientPrice` (**snapshot**,
  netto), `wToolsOverrideType`/`wToolsOverrideValue`, `ownToolsOverrideType`/`ownToolsOverrideValue`,
  `costVariant` (null = inherit section), `hiddenInExport`, `note`.
- **`kosztorys-stages`** (`kosztorys-stages.ts:29-33`): `investment` (req), `ordinal` (unique per
  investment), `label`.
- **`stage-progress`** (`stage-progress.ts:28-32`): `item` (req FK), `stage` (req FK), `qtyDone`.
  Sparse — a missing row means 0; upserted by `(item, stage)` via `ON CONFLICT`.
- **Investment-level pricing settings** (columns on `investments`): `wToolsCoeff` (default 0.65),
  `ownToolsCoeff` (0.55), `vatRate` (0.08 fraction).

Migrations: `20260708_2_add_kosztorys_sections_items.ts:8-53`, `20260709_0_add_kosztorys_stages.ts:9-34`,
`20260710_0_add_vat_rate_to_investments.ts:7-11`, `20260710_1_add_kosztorys_snapshots.ts:9-28`.
All FKs `ON DELETE CASCADE`; prices are `numeric`.

#### Keep-vs-reset classification (load-bearing for the preset serializer)

- **KEEP (structural)**: section `name`/`displayOrder`/`defaultCostVariant`/`wToolsCoeff`/`ownToolsCoeff`;
  item `section`/`displayOrder`/`description`/`unit`/`clientPrice`/all four `*Override*`/`costVariant`;
  investment `wToolsCoeff`/`ownToolsCoeff`/`vatRate` — but see D-note: applying to a **different**
  investment probably should NOT overwrite the target's VAT/coeffs.
- **RESET (job-specific)**: item `plannedQty`, `measuredQty`, `discountType`, `discountValue`,
  `hiddenInExport`, `note`; all of `stage-progress` (`qtyDone`); and — a design choice —
  `kosztorys-stages` themselves (they exist only to track this job's progress).

The `isRowPopulated`/`isSectionPopulated` predicate (`v2-rows.ts:18-29`) — `measuredQty !== 0` or any
`stage_* !== 0` — is the delete-guard's "populated" definition and a good cross-check for "job data
present".

### Calc / derivation layer

- **`src/lib/kosztorys/calc.ts`** — pure formulas: `applyDiscount` (17-21), `effectiveCoeff`
  (section overrides global, 27-30), `subcontractorPrice` (override amount|coeff|inherit, 33-39),
  `viewPrice` (41-44), `rowNetForView` = `applyDiscount(measuredQty × viewPrice)` (47-49),
  `stageValueForView` (52-58), `rowRemainingForView` (61-67). **VAT/brutto is NOT here** — computed
  at the UI (`kosztorys-section-summary.tsx:292`, `grandNet × (1 + vatRate)`).
- **`src/lib/kosztorys/v2-rows.ts`** — `treeToRows` (49-77) flattens + denormalizes section/global
  coeffs + `vatRate` + spreads progress into `stage_<id>` keys; `ITEM_FIELDS` (32-47) = the 14
  grid-editable fields = `ItemPatchT` keys; `diffRow` (84-103); `buildBlankRow` (178-208) = the
  reset/default shape.
- **Shapes** (`src/types/kosztorys.ts`): `KosztorysTreeT` (89-96), `KosztorysV2RowT` (100-114),
  `KosztorysItemT` (22-40), `ItemPatchT` (45-63).

### Server actions that build a kosztorys (`src/lib/actions/kosztorys.ts`)

All via `protectedAction()` (`run-action.ts:33-63`) → uniform `requireAuth(MANAGEMENT_ROLES)`
(`run-action.ts:41`; `MANAGEMENT_ROLES = ['ADMIN','OWNER','MANAGER']`, `roles.ts:14`). Each declares
its cache-tag revalidation list (3rd arg), fired once post-success.

- Field autosave: `updateItemFieldAction` (`:62`, `['kosztorysItems']`), `updateSectionFieldAction`
  (`:75`), `updateInvestmentCoeffsAction` (`:88`), `updateInvestmentVatAction` (`:105`).
- Structure: `addSectionAction` (`:123`), `removeSectionAction` (`:148`, **guarded** + forces
  `captureAutoSnapshot`), `addItemAction` (`:179`), `removeItemAction` (`:209`, guarded, no snapshot),
  `swapItemOrderAction` (`:239`, swaps 2 rows only).
- Stages: `addStageAction` (`:268`), `updateStageFieldAction` (`:294`), `removeStageAction` (`:312`,
  guarded + snapshot), `setStageProgressAction` (`:348`, raw-SQL `ON CONFLICT` upsert).

**New-investment kosztorys creation — there is NO bootstrap seeding.** `createInvestmentAction`
(`src/lib/actions/investments.ts:33-49`) only creates the `investments` row; the editor builds
sections/items on demand. **This is exactly the gap S-09 (a) fills** — offer "seed from preset" at
create-time or in the empty editor. (The Google Sheet side — `provisionSheetAction`
`investments.ts:57-101` — is a separate on-demand CTA, unrelated to the in-app tree.)

Read path: **`getKosztorysTree(investmentId)`** (`src/lib/queries/kosztorys.ts:24-129`) — 5 parallel
`depth:0` queries → `{sections, stages, progress, globalCoeffs, vatRate}`; guarded by
`assertCompletePage`. Consumed by `inwestycje/[id]/kosztorys/page.tsx:32-61`.

### Legacy Google Sheets template seeding

`KOSZTORYS_TEMPLATE_SHEET_ID` (+ optional `KOSZTORYS_DRIVE_FOLDER_ID`) — `env/schema.ts:43-44`. Used
only in `createSheetFromTemplate(investmentName)` (`src/lib/google/drive.ts:10-29`): a
`drive.files.copy({fileId: templateId})` — a **whole-spreadsheet Drive copy** of a pre-built master.
The master carried the entire structure (sections, rows, columns, formulas); the app wrote nothing
structural. This is the "start from a skeleton" behaviour S-09 restores in-app.
(`sheets-sync.ts` / `collections/sheets.ts` are a *different* concern — expense/transfer mirroring —
not kosztorys-structure seeding.)

### S-06 snapshot subsystem — the reuse target

Files: `snapshot-format.ts`, `serialize-kosztorys.ts`, `restore-kosztorys.ts`,
`capture-auto-snapshot.ts`, `src/lib/actions/kosztorys-snapshots.ts`, `src/lib/db/snapshots.ts`
(the raw DAO), migration `20260710_1_add_kosztorys_snapshots.ts`.

- **`SnapshotPayloadT`** (`snapshot-format.ts:24-31`) — flat: `{schemaVersion, sections[], items[]
  (each with OLD sectionId), stages[], progress[] (OLD item/stage ids), settings:{wToolsCoeff,
  ownToolsCoeff, vatRate}}`. `SNAPSHOT_SCHEMA_VERSION = 1` written to both a `schema_version` column
  and the payload. **No version-checking on restore** — the contract is *tolerant deserialization*
  (default missing, skip orphan children); a differing version still restores best-effort.
- **`serializeKosztorys(investmentId)`** (`serialize-kosztorys.ts:8-26`) — pure read, output is
  investment-agnostic. Directly reusable as a preset serializer base (then strip job fields).
- **`restoreKosztorys`** (`restore-kosztorys.ts:9-110`) — **caller owns the transaction**. Uses the
  tx-scoped Drizzle handle via `getDb(payload, req)` (`get-db.ts:12-19`) and `sql` from
  `@payloadcms/db-vercel-postgres`. **Wipe** (`payload.delete` sections + stages, cascades) then
  **reinsert** sections → items → stages → progress, each level ONE bulk
  `INSERT … VALUES(...) RETURNING id`, old→new id maps zipped **by index** (relies on VALUES order).
  `investmentId` is already threaded into every insert row (`:44,61,77`) — **retargeting to a
  different investment is trivial**. Perf: bulk insert chosen because row-by-row was ~12.6s for
  ~1000 rows (`:13-19`).
- **Settings write-back** (`:100-109`) — `payload.update` on `investments` with the snapshot's
  VAT/coeffs. **A preset applier to a different investment should DROP or make this optional.**
- **Action wrapper** `restoreSnapshotAction` (`kosztorys-snapshots.ts:66-84`):
  `beginTransaction` → fake `req` with `transactionID` + `context:{skipRevalidation:true}` →
  forced pre-restore `captureAutoSnapshot` → restore → `commitTransaction` (rollback+rethrow on
  error); post-commit revalidates `['kosztorysSections','kosztorysItems','kosztorysStages',
  'stageProgress','investments']`.
- **No external FK into the kosztorys tree** — the `INVESTMENT_EXPENSE` materials mirror keys on
  expense categories + investment, not item ids; `kosztoryses` (Sheets registry) keys on
  `investment_id`. So wipe-and-reinsert (and a preset insert) collide with nothing external.
- **Tests** (`src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`,
  `.../lib/actions/kosztorys-restore.test.ts`, `.../kosztorys-snapshots.test.ts`,
  `.../lib/db/snapshots.test.ts`): real-DB (gated on `DB_POSTGRES_URL && PAYLOAD_SECRET`), mock
  `next/cache`. The roundtrip test's `canonical()` id-free deep-equal harness is directly reusable
  for a preset serialize/apply roundtrip.

### Autocomplete + item-add UX

- **Combobox primitives**: `src/components/ui/command.tsx` (cmdk: `Command`/`CommandInput`/
  `CommandList`/`CommandItem`) + `ui/popover.tsx`. The canonical combobox is `FormCombobox`
  (`src/components/forms/form-components/form-combobox.tsx:31`) — **in-memory filter over a
  preloaded list, TanStack-Form-bound**. Used via `EntityComboboxField`
  (`form-fields/entity-combobox-field.tsx:50`) for investment/worker/register pickers. **There is NO
  async/remote-search combobox in the repo.**
- **Adding an item today = blank-row append**: toolbar "＋ pozycja"
  (`kosztorys-editor-toolbar.tsx:90-94`) or section "+" (`kosztorys-section-summary.tsx:229-236`) →
  `handleAddItem` (`use-kosztorys-editor.ts:188`) → `addItemAction` + `buildBlankRow` +
  `applyAddItem`. The **`description` cell is a plain `textColumn`**
  (`src/lib/tables/kosztorys-v2-columns.tsx:351-356`) — free text, no autocomplete. Custom cells
  already exist in that file (`DiscountTypeCell:117`, `subcontractorPriceColumn:160`,
  `subcontractorModeColumn:200`) — **the template for an autocomplete `description` cell** that, on
  select, calls `setRowData({...rowData, description, unit, clientPrice})` (a multi-field patch
  flowing through the existing diff/autosave pipeline, `use-kosztorys-editor.ts:442`).
- **dsg constraint**: columns are frozen at mount; the grid remounts on a `key` change
  (`kosztorys-editor-body.tsx:96`). A preset-prace list passed to `buildV2Columns` must be in the
  remount `key` or read through a ref (same class as the `stages`/`view`/`widths` lessons).
- **Where preset CTAs live**: mirror the snapshot UI — toolbar right cluster
  (`kosztorys-editor-toolbar.tsx:99-106`, next to `SaveSnapshotButton` + "Wersje"),
  `save-snapshot-button.tsx:12` (self-contained Dialog+input) as the "Save as preset" template, and
  `kosztorys-versions-drawer.tsx:26` (fetch-on-open list with per-row "Przywróć") as the "seed from
  preset" picker template. Shell owns drawer state + remount-on-apply (`kosztorys-editor-v2.tsx`).

## Code References

- `src/collections/kosztorys-{sections,items,stages}.ts`, `src/collections/stage-progress.ts` — schema
- `src/lib/kosztorys/calc.ts`, `v2-rows.ts` — derivation + flatten; `src/types/kosztorys.ts` — shapes
- `src/lib/actions/kosztorys.ts` — build actions; `src/lib/queries/kosztorys.ts:24-129` — read path
- `src/lib/actions/investments.ts:33-49` — create (no seeding); `src/lib/google/drive.ts:10-29` — legacy template copy
- `src/lib/kosztorys/{snapshot-format,serialize-kosztorys,restore-kosztorys,capture-auto-snapshot}.ts`, `src/lib/db/snapshots.ts`, `src/lib/actions/kosztorys-snapshots.ts` — reuse target
- `src/lib/tables/kosztorys-v2-columns.tsx:351` — the `description` textColumn to upgrade
- `src/components/kosztorys/{kosztorys-editor-toolbar,save-snapshot-button,kosztorys-versions-drawer,kosztorys-editor-v2}.tsx` — CTA/UI templates
- `src/components/forms/form-components/form-combobox.tsx` — in-memory combobox (no async variant)

## Architecture Insights

- **Reuse vs fork for the preset apply**: reuse `serializeKosztorys` + the bulk-insert/id-remap
  engine + the tx wrapper; **fork** these — (1) drop the unconditional wipe (a preset *appends*/seeds,
  it doesn't obliterate the target unless the target is empty); (2) **strip/zero job-specific fields**
  at serialize time (progress, measuredQty, plannedQty, discount, note, hiddenInExport); (3) **do not
  write back the preset's VAT/coeffs** onto a different target investment (or make it opt-in);
  (4) presets get **their own global table + lifecycle** — not `kosztorys_snapshots` (investment-scoped,
  cascade-deleted, GC'd 7/365d).
- **Global scope is the new structural axis.** All kosztorys collections are `investment`-required.
  Presets are the first global concept — decide the storage shape (see D9): a preset table holding a
  serialized payload jsonb (mirrors snapshots) vs normalized preset-sections/preset-items tables. The
  jsonb-payload shape is the lower-friction match to the existing serialize/apply engine.
- **Autocomplete (c) can be decoupled from preset storage.** "Autocomplete over preset prace" is a
  read-only view (union of `prace` across presets). It only needs a query over whatever preset
  storage D9 lands on — so its shape depends on D9. A jsonb-payload preset makes "union of prace" a
  scan+flatten; normalized preset-items makes it a plain indexed query.
- **Two dsg + React-Compiler traps apply** (from `lessons.md`): the autocomplete-cell column set /
  preset list must go through the grid remount `key` or a ref; never fire the apply action inside a
  `setState` updater; patch denormalized fields optimistically rather than trusting `router.refresh()`.

## Historical Context (from prior changes)

- `context/changes/kosztorys-snapshots/change.md` + `plan.md` — the owner decisions that shaped the
  serialize/restore engine (independent snapshots not event-log; tolerant versioning; tx wipe-reinsert;
  MANAGEMENT_ROLES). The preset engine forks this.
- `context/archive/2026-07-09-kosztorys-price-models/` — the price-view toggle + coefficient/override
  derivation a preset must preserve as structural.
- `context/changes/kosztorys-mvp/change.md` — the POC decisions; the "podpowiadarka arrives with
  szablony, prices stay typed snapshots so a suggestion layer sits on top" note that motivates folding
  the catalogue into presets (Model A).
- `context/foundation/lessons.md` — dsg remount-`key` (2 entries), no-action-in-setState,
  optimistic-denormalized-patch, migration naming/verification lessons all bear on this slice.

## Related Research

- None prior for presets. This is the first research artifact for `kosztorys-preset`.

## Open Questions

Load-bearing, for the owner at plan time (carried from roadmap S-09):

1. **D9 — preset scope**: one global default preset vs a named library picked at create-time (owner
   leans library). Decides storage shape (single-row default vs a preset collection) and the "seed
   from preset" UX (auto vs picker).
2. **D10 — save-as + retroactivity**: save-as-new vs overwrite an existing preset; and whether
   editing a preset retroactively touches kosztorysy already spawned from it (rec: no — snapshot rule,
   consistent with the whole-slice "prices are frozen seed-defaults" stance).
3. **Duplicate prace across presets** (autocomplete): show each occurrence, or dedupe by opis with a
   default price? Only bites once >1 preset exists.
4. **Preset storage shape** (engineering, follows from D9): jsonb-payload-per-preset (reuses the
   snapshot engine almost verbatim) vs normalized preset-sections/preset-items tables (cleaner for
   "union of prace" autocomplete queries, more migration work). Recommend jsonb to match the reuse.
5. **Does "seed from preset" wipe or append?** Seeding a fresh/empty kosztorys is an append; offering
   it on a *non-empty* kosztorys needs a wipe-or-merge decision (mirror the snapshot restore confirm +
   pre-apply auto snapshot for safety).
6. **Stages in a preset?** A preset carries structure; stages are progress-tracking scaffolding.
   Decide whether a preset seeds stage *labels* (structure) while resetting all `qtyDone` (progress),
   or omits stages entirely.
