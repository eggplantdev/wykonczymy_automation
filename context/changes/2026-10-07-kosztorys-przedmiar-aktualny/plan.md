# „Aktualizacja przedmiaru” Implementation Plan

## Overview

Every kosztorys pozycja gets a second quantity, **„Aktualizacja przedmiaru”**, beside the
existing Przedmiar, which is renamed **„Przedmiar ofertowy”**. Aktualizacja carries every scope
change agreed after the offer (extra works, dropped works, changed quantities). % wykonania,
Pozostało and the overrun signal are measured against it. The offer, the prognoza marży and the
section pie stay on ofertowy. Owner rulings: `change.md`. Codebase map: `research.md`.

## Current State Analysis

- Przedmiar is one field, `planned_qty numeric NOT NULL DEFAULT 0` → `plannedQty`
  (`src/collections/kosztorys-items.ts:47`, `src/lib/kosztorys/types.ts:49`). It does two jobs:
  „what was offered” and „the progress denominator”. This change splits those jobs.
- Nothing on the transactions plane reads przedmiar (reconciliation, robocizna/marża v2,
  `deriveFinancials` read only the executed value), so the change stays inside the kosztorys plane.
- The AI-review columns (`src/migrations/20261007_0_add_ai_review_columns.ts`, commit `b6d73462`)
  are the precedent: they threaded nullable item fields through every tree writer.
- The subcontractor price is the precedent for „follows until edited”. Its value is nullable
  (`null` = auto), the cell renders auto `text-muted-foreground italic`, and its policy's `clear`
  writes `null` (`src/components/kosztorys/editor/grid/cells/subcontractor/price-cell.tsx:46-58`,
  `src/lib/kosztorys/subcontractor-price-edit.ts`).
- The investor document hides columns until the first etap entry through
  `emptySettlementColumnIds` (`src/lib/kosztorys/settlement-columns.ts`). The **worker** document
  calls the same function (`worker-view/columns.ts:68`), so investor-only offer-phase columns cannot
  go into the shared `SETTLEMENT_TOTAL_COLUMNS`.

## Desired End State

- Editor:
  - Columns are „Przedmiar ofertowy”, „Wartość netto przedmiar”, then „Aktualizacja przedmiaru”
    and „Wartość netto aktualizacji przedmiaru”, all visible by default.
  - An unedited aktualizacja cell shows the ofertowy quantity in grey italics. A typed value shows
    black. Delete makes it follow again. Typing 0 takes the item out of scope.
  - „Razem” sums both values.
- % wykonania, Pozostało, the red overrun, section completion, the progress counter and the filters
  „bez przedmiaru” / „z przedmiarem” all read the aktualizacja.
- Prognoza marży, the section pie, the „Oferta” column filter, the AI review and the sheet comparison
  read ofertowy.
- Investor document (podgląd, share link, „Generuj ofertę”):
  - Before the first etap entry it shows only the offer: no aktualizacja, no Pozostało.
  - After the first entry, „Aktualizacja przedmiaru” is ticked by default. Its value is an
    unticked option.
- Worker surfaces (link, PDF, „Drukuj do wypełnienia”, report page, report review) show only
  „Aktualizacja przedmiaru”, translated in uk/ru.
- Extra work accepted from a worker report lands with ofertowy 0 and aktualizacja = the reported
  quantity.
- Sheet import fills ofertowy. A re-import keeps a hand-edited aktualizacja.

### Key Discoveries:

- `numericFieldPolicy.clear` writes 0 (`src/lib/kosztorys/cell-edit.ts:131-146`). The aktualizacja
  needs its own policy, where clear writes `null`.
- `itemPatchSchema.plannedQty` is `z.coerce.number()`, which turns null into 0. The new key must use
  `z.coerce.number().nullable()`, the same wrapping as `wToolsOverrideValue`
  (`src/lib/kosztorys/item-patch-schema.ts:26-29`).
- `sectionSubtotalsForView` uses one `plannedNet` both as the section's offer and as the
  `completionRatio` denominator (`src/lib/kosztorys/settlement-aggregates.ts:97-130`).
- Worker settings drop unknown hidden-column keys on parse (`worker-view/settings.ts:48-53`). Moving
  the worker document from `plannedQty` to the new id would silently untick a stored „Przedmiar”
  choice unless the parse maps the old key.
- `computedColumnValues` throws on a computed id that is not registered in `byField`
  (`src/lib/kosztorys/columns/column-values.ts:115`).
- Untagged money columns show on both VAT axes (`COLUMN_MONEY_AXIS`, `column-config.ts:145-159`).

## What We're NOT Doing

- No change to transactions-plane figures (marża, bilans, robocizna v1/v2, reconciliation).
- No writing of the aktualizacja to the owner's Google Sheet. The app never writes column N.
- No bulk „set aktualizacja” action, and no „oferta wysłana” freeze state.
- No szablon-workbench column. A szablon has no przedmiar.
- The internal identifier `plannedQty` is not renamed. Only labels change.
- The sheet-import header matcher `exactly('przedmiar')` is not renamed (`sheet-import/columns.ts:24,69`).
- EX-495 (rabat in the offer value) is not resolved here. Both values follow today's rule.

## Implementation Approach

**Storage stores only the hand edit.**

- Column: `current_planned_qty numeric NULL` → `currentPlannedQty: number | null` on the item and the
  grid row.
- `null` means „follows ofertowy”.
- Everything that computes reads one resolver: `resolvedCurrentPlannedQty(row) = row.currentPlannedQty
?? row.plannedQty`.
- No backfill. Rule A, the re-import rule and the AI statuses that write ofertowy all work without
  extra code, because an unedited row has no aktualizacja of its own.
- Every writer that has no reason to set one writes `null`.

**Naming** (AGENTS.md naming rules):

- `currentPlannedQty` / `currentPlannedNet` / `currentPlannedGross` share the `planned` base with the
  ofertowy pair, so the two read as one family.
- No plane suffix: both live on the kosztorys plane.

**Phase order** follows dependencies: data, then calculation, then the editor, then the investor
document, then worker surfaces, then docs. Each phase builds and its specs pass on their own.

## Critical Implementation Details

- **State sequencing — Delete vs 0.**
  - The aktualizacja policy's `clear` (keyboard Delete, `deleteValue`, a pasted blank) writes `null`.
  - A typed `0` writes `0`.
  - The cell's draft must not turn an empty commit into 0. Follow the subcontractor price cell, whose
    empty input reverts to auto.
- **Offer-phase columns are investor-only.**
  - `remaining`, `currentPlannedQty` and `currentPlannedNet` stay off the investor document until
    the first etap entry.
  - They must NOT stay off the worker document, which calls the same helper. The worker's Pozostało
    is `remainingForPlane`, and it stays visible from day one, as today.
- **Deploy ordering.** The migration is additive, so prod is migrated **before** the push
  (`pnpm db:migrate:prod`, human-run). That is owed only when this ships.

## Phase 1: Data model and writers

### Overview

Add the nullable column and thread it through every path that writes or copies a pozycja. After
this phase the value exists, persists and round-trips, but nothing reads it yet.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<YYYYMMDD>_0_add_current_planned_qty.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Hand-write it, copying `20261007_0_add_ai_review_columns.ts`.

**Contract**: `ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "current_planned_qty" numeric;`

- No default, no backfill, nullable.
- Same migration: append `"currentPlannedNet"` to every **non-NULL** `hidden_columns` array in
  `kosztorys_client_view` and `kosztorys_client_view_defaults`.
  - Why: the stored value is the HIDDEN set, so an investment with saved settings would otherwise
    show the new value column ticked. The owner ruled it unticked by default.
  - NULL rows already resolve to the code default, which leaves it unticked.
  - Safe under the old code: `sanitizeClientViewSettings` drops a key outside its ceiling.
  - SQL shape: `20260928_2_client_view_single_set.ts`.
- `down` drops the column and removes the appended key.

#### 2. Collection, types, tree read

**File**: `src/collections/kosztorys-items.ts`, `src/lib/kosztorys/types.ts`, `src/lib/db/kosztorys-tree.ts:71-76,161`

**Intent**: Add a nullable number field. Make `currentPlannedQty: number | null` **required** on
`KosztorysItemT`, as the AI fields are, so `tsc` lists every code-built item. Add it to the tree
SELECT and mapper, nullable, not through `num()`, which would turn null into 0.

**Contract**: `KosztorysItemT.currentPlannedQty: number | null`. The key is also on `ItemPatchT`
(`types.ts:86-104`) and on `KosztorysV2RowT`.

#### 3. Resolver

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: The single place that turns the stored value into the effective aktualizacja. Every
reader in later phases calls it and never reads `currentPlannedQty` directly.

**Contract**: `resolvedCurrentPlannedQty(row: { plannedQty: number; currentPlannedQty: number | null }): number`.

#### 4. Insert funnel, snapshot, szablon

**File**: `src/lib/kosztorys/insert-rows.ts:21-42,130`, `src/lib/kosztorys/snapshot-format.ts:110-188`, `src/lib/kosztorys/serialize-preset.ts:28-37`

**Intent**:

- Add the column to `insertItems`' positional columns and tuple.
- Snapshot read is tolerant with `?? null`. An old snapshot has no key, which means „follows”, which
  is correct. No `SNAPSHOT_SCHEMA_VERSION` bump: the change is additive with a fallback
  (lessons.md:788).
- The szablon serializer writes `null`.

**Contract**: snapshot item shape gains an optional `currentPlannedQty`.

#### 5. Code-built items and the worker extra

**File**: `src/lib/kosztorys/item-from-fields.ts:38`, `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:21`, `src/lib/kosztorys/accept-worker-report.ts:392`

**Intent**:

- „Nowa praca” and catalogue placement write `null`.
- An extra work accepted from a worker report writes ofertowy `0` and aktualizacja = the reported
  quantity. Scope grew after the offer, and the offer stays the offer.

**Contract**: the worker-extra builder sets `plannedQty: 0, currentPlannedQty: <reported qty>`.

#### 6. Sheet import

**File**: `src/lib/kosztorys/sheet-import/build-import-plan.ts:218-245`

**Intent**: Matched rows carry `currentPlannedQty` from `current`, the way `note` and the AI fields
are carried (`:234-238`). New rows get `null`. That gives the owner's rule: the sheet refreshes
ofertowy, and a hand-edited aktualizacja survives (sheet 100, app 120 → 120).

**Contract**: `ImportPlan` matched-row item = sheet item + `currentPlannedQty: current.currentPlannedQty`.

#### 7. Grid patch path

**File**: `src/lib/kosztorys/item-patch-schema.ts`, `src/lib/kosztorys/v2-rows.ts:6-21` (`ITEM_FIELDS`), `src/lib/actions/kosztorys.ts:124-140`

**Intent**: Make the field autosavable. Undo lanes, coalescing and reversal are per field, so they
come for free (`save-lanes.ts`, `undo-coalesce.ts`, `undo-reversal.ts`).

**Contract**: `currentPlannedQty: z.coerce.number().nullable()`, with `.nullable()` wrapping the
coercion so null stays null. The DB column it maps to is `current_planned_qty`.

#### 8. Seed scripts and test fixtures

**File**: `src/scripts/seed-*.ts`, `src/scripts/perf-seed-kosztorys.ts`, `src/__tests__/helpers/kosztorys-tree.ts`, `src/__tests__/lib/kosztorys/row-conditions/fixtures.ts`

**Intent**:

- Seeds don't need the field (it is nullable). Touch them only where `tsc` demands it.
- Fixture builders default to `currentPlannedQty: null`. Do not default it to a copy of
  `plannedQty`: that would make every Phase 2 test pass whichever field the code reads
  (lessons.md:360).

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate`
- Migration applies to the test DB: `pnpm db:migrate:test`
- After migrate, every non-NULL stored investor `hidden_columns` contains `currentPlannedNet`; NULL rows stay NULL (psql check against local 5433)
- Insert funnel matches the table: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`
- Tree SELECT matches the mapper: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts` (path per the mirror rule; locate with `find src/__tests__ -name 'kosztorys-tree-sql-drift*'`)
- Snapshot round-trip keeps a hand-edited aktualizacja and restores an old snapshot as `null`: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`
- Import plan carries a hand-edited aktualizacja on a matched row and writes `null` on a new row (new case in the build-import-plan spec)
- Worker extra lands with ofertowy 0 and aktualizacja = reported quantity (new case in the accept-worker-report spec)
- Patch schema keeps `null` as `null` and coerces `"12"` to 12 (new case in the item-patch-schema spec)

#### Manual Verification:

- None for this phase. Nothing reads the value yet. Covered by Phase 3's editor checks.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Calculation layer

### Overview

Move every progress reader to the resolved aktualizacja, add its value figure, and split the
places where one przedmiar figure did two jobs. Tests are rewritten **red-first**, on fixtures
where ofertowy ≠ aktualizacja.

### Changes Required:

#### 1. Core primitives

**File**: `src/lib/kosztorys/calc.ts`, `src/lib/kosztorys/settlement-rows.ts:66-73,101-104`

**Intent**:

- `rowDoneFraction` divides by the resolved aktualizacja. Update its „of the OFFER” doc comment.
- `rowRemainingForExecutedQty` takes the quantity as an **explicit parameter, with no default**
  (lessons.md:1581). Callers pass the resolved aktualizacja.
- `hasStagesOverPlanned` / `isRemainingOverrun` judge against the aktualizacja. Otherwise every
  agreed extra would stay red forever.
- Add `rowCurrentPlannedNetForView` beside `rowPlannedNetForView`. It uses the same
  `netForQtyForView`, so the rabat rule is identical.
- `rowPlannedNetForView`, `rowPlannedNetPreDiscountForView` (prognoza) stay on ofertowy.
- Fix the comment at `calc.ts:25`, which claims a single przedmiar reader.

**Contract**: `rowCurrentPlannedNetForView(row, view): number`;
`rowRemainingForExecutedQty(row, plannedQty: number, executedQty, view)`. The exact param order
follows the current signature.

#### 2. Column values and totals

**File**: `src/lib/kosztorys/columns/column-values.ts:61-115`, `src/lib/kosztorys/columns/column-totals.ts:38-83`

**Intent**:

- Register computed `currentPlannedNet` and `currentPlannedGross` in `byField`.
- `remaining`, `donePercent`, `plannedNetForPlane` and `remainingForPlane` read the aktualizacja.
- Totals: add `currentPlannedNet` / `currentPlannedGross` sums beside `plannedNet`. The `remaining`
  total excludes rows that overrun the aktualizacja.

**Contract**: new computed column ids `currentPlannedNet`, `currentPlannedGross`.

#### 3. Section subtotals and progress counter

**File**: `src/lib/kosztorys/settlement-aggregates.ts:97-130`, `src/components/kosztorys/editor/use-kosztorys-editor.ts:740-755`

**Intent**: Split the dual-use `plannedNet`. The section offer figure stays ofertowy. The
`completionRatio` denominator and the progress counter (doneNet / planned) read the aktualizacja
value.

**Contract**: the section subtotal shape gains `currentPlannedNet`, and `completionRatio` uses it.

#### 4. Row conditions, SQL readers

**File**: `src/lib/kosztorys/row-conditions/registry.ts:115-127,365-376,472-478`, `src/lib/db/investment-trash.ts:15`, `src/lib/db/catalogue-usage.ts:18`

**Intent**:

- The „bez przedmiaru” / „z przedmiarem” filters and `work-without-planned-qty` read the
  aktualizacja. `revealsColumns` reveals the aktualizacja column.
- `client-empty` treats a row as empty only when ofertowy = 0, aktualizacja = 0 and there is no
  work.
- `KOSZTORYS_USED` (trash purge) and katalog „Użyta” treat a row as used when
  `planned_qty > 0 OR current_planned_qty > 0`.
- The AI filters stay on ofertowy.

**Contract**: SQL predicate `(planned_qty > 0 OR COALESCE(current_planned_qty, 0) > 0)`. Mirror
whatever the existing predicate's shape is.

#### 5. Explicitly unchanged (verify, don't edit)

**File**: `margin-forecast.ts`, `chart-slices.ts:64`, `offer-columns.ts` (`OFFER_VISIBLE_COLUMNS`), `review-status.ts`, `build-sheet-comparison.ts:154`, `footer-totals.ts:83`

**Intent**: These stay on ofertowy by ruling: the prognoza, the pie, „Oferta”, the AI review, and the
sheet S456 comparison, because the sheet has one przedmiar, which is ofertowy.

### Success Criteria:

#### Automated Verification:

- Rewritten red-first on ofertowy ≠ aktualizacja fixtures, each failing against the pre-change code before the fix: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-calc.test.ts src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts src/__tests__/lib/kosztorys/columns/column-values.test.ts src/__tests__/lib/kosztorys/columns/column-totals.test.ts`
- Overrun and plane specs on the same fixtures pass: `remaining-overrun-tone`, `planned-net-for-plane-columns`, `subcontractor-due-by-plane`, `column-value-parity`
- Row-condition filters read aktualizacja; `client-empty` needs both zero: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`
- Section `completionRatio` uses aktualizacja and the section offer stays ofertowy (new case in the settlement-aggregates spec)
- Prognoza is unchanged when only aktualizacja differs: `pnpm exec vitest run src/__tests__/lib/kosztorys/margin-forecast.test.ts`

#### Manual Verification:

- None for this phase. Rendered in Phases 3–5.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Editor columns

### Overview

Show the two new columns, rename Przedmiar to „Przedmiar ofertowy”, and give the aktualizacja cell
its follow/edited look and Delete behaviour.

### Changes Required:

#### 1. Edit policy

**File**: `src/lib/kosztorys/current-planned-qty-edit.ts` (new, beside `subcontractor-price-edit.ts`)

**Intent**: The `CellEditPolicyT` for the aktualizacja. `applyValue` writes the number, 0 included.
`clear` writes `null`. `snapshot` / `restore` round-trip the stored value, null included, so undo
restores „follows”.

**Contract**: `currentPlannedQtyPolicy<RowT>(): CellEditPolicyT<RowT, number | null>`.

#### 2. Cell and column

**File**: `src/components/kosztorys/editor/grid/cells/current-planned-qty-cell.tsx` (new), `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:178-187,350-354,398-417`

**Intent**:

- The cell shows `resolvedCurrentPlannedQty`. When the stored value is `null` it is grey italic
  (`text-muted-foreground italic`, the subcontractor-price auto tone). Otherwise it is black.
- `deleteValue` / `pasteValue` route through the policy.
- Insert the column right after the ofertowy pair. Its value twin is
  `resolvedColumn('currentPlannedNet' | 'currentPlannedGross')`, per axis, like `plannedValue`.

**Contract**: column id `currentPlannedQty`. Value ids `currentPlannedNet` / `currentPlannedGross`.

#### 3. Column registries

**File**: `src/lib/kosztorys/columns/column-config.ts`

**Intent**: Register the new ids in every registry their siblings appear in:

- `COLUMN_LABELS`
- `TRANSLATED_LABEL_KEYS` (the worker sees it)
- `PRZEDMIAR_ANCHORED_COLUMNS` (the gross twin, so it never leaks into crew views)
- `CREW_PLANE_ONLY_COLUMNS` where the ofertowy twin is
- `COLUMN_MONEY_AXIS` (tag net/gross; an untagged value shows on both axes)
- `COLUMN_LAYER`

None go into `DEFAULT_HIDDEN_COLUMNS`: they are visible by default.

**Contract**: labels `currentPlannedQty: 'Aktualizacja przedmiaru'`, `currentPlannedNet:
'Wartość netto aktualizacji przedmiaru'` (gross: „Wartość brutto aktualizacji przedmiaru”);
`plannedQty: 'Przedmiar ofertowy'`.

#### 4. Labels and tips — rename

**File**: `src/lib/i18n/dictionaries/pl.ts:236-295` (+ `uk.ts`, `ru.ts`), `src/lib/kosztorys/print/columns.ts:36-43`, `header-tips.ts`, the label sites listed in `research.md` §5

**Intent**:

- „Przedmiar” → „Przedmiar ofertowy” wherever it names the ofertowy column.
- Add „Aktualizacja przedmiaru” plus a uk/ru translation of that name, not of „Przedmiar”.
- Header tips for Pozostało and % wykonania name the aktualizacja. The ofertowy tip says it is the
  offer.
- `print/columns.ts` stops hardcoding the label and gains a `CURRENT_PLANNED_QTY_COLUMN` beside
  `PLANNED_QTY_COLUMN`.
- Keep `sheet-import/columns.ts`.

**Contract**: dictionary key `grid.currentPlannedQty`.

#### 5. Footer and history

**File**: section/total footer cells, `src/lib/kosztorys/history/diff-versions.ts:31,138-147`, `history/change-rows.ts:37,43`, `history-grid.ts:26`, `history/types.ts:20`

**Intent**: „Razem” shows both value totals (from Phase 2's totals). The history diff includes an
aktualizacja change, since those are the scope changes worth seeing. „Follows” vs a number reads as
„— → 120”.

**Contract**: history field list gains `currentPlannedQty`.

### Success Criteria:

#### Automated Verification:

- Policy: Delete → `null`, typed 0 → 0, undo of a first edit restores `null` (new spec `src/__tests__/lib/kosztorys/current-planned-qty-edit.test.ts`)
- Cell renders grey for `null` and black for a stored value, and Delete makes it grey again (new DOM spec `src/__tests__/components/kosztorys/editor/grid/cells/current-planned-qty-cell.test.tsx`)
- History diff lists an aktualizacja change: `pnpm exec vitest run src/__tests__/lib/kosztorys/history/diff-versions.test.ts`
- Column registries accept the new ids (existing column-config / column-selection specs pass)

#### Manual Verification:

- On local dev (`INV=6` seed), the editor shows „Przedmiar ofertowy”, „Wartość netto przedmiar”, „Aktualizacja przedmiaru” and „Wartość netto aktualizacji przedmiaru” in that order. The aktualizacja is grey and equals ofertowy.
- Type 120 in aktualizacja: the cell goes black, and % wykonania and Pozostało move. Delete: it goes grey and shows the ofertowy again. Type 0: % wykonania shows „—”, and the row still shows its executed value.
- Change ofertowy on an unedited row: the aktualizacja follows. On an edited row it does not.
- „Razem” shows both value totals. Reload, and the hand edit persists.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Investor document

### Overview

Before the first etap entry the investor document is the pure offer. After it, the document adds
the aktualizacja, and % wykonania / Pozostało follow it. This folds in `2026-10-06-offer-hides-remaining`.

### Changes Required:

#### 1. Offer-phase hidden set

**File**: `src/lib/kosztorys/settlement-columns.ts`

**Intent**: Add an investor-only list. These columns are off until the first etap entry: `remaining`,
`currentPlannedQty`, `currentPlannedNet`. Also add an investor wrapper that
adds them to `emptySettlementColumnIds` when no etap is filled. The shared `SETTLEMENT_TOTAL_COLUMNS`
stays as is, because the worker document reads it. Rewrite the 2026-09-28 „Pozostało is deliberately
not here” comment: it is now reversed for the investor.

**Contract**: `investorEmptyColumnIds(rows, stages, alsoFilled?): ReadonlySet<string>`.

#### 2. Investor callers

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts:566-570`, `src/lib/kosztorys/print/offer.ts:46`, plus any other investor caller found with `grep -rn emptySettlementColumnIds src`

**Intent**: The investor branches call the wrapper. The worker branch keeps `workerDataHiddenColumns`.

#### 3. Document columns and defaults

**File**: `src/lib/kosztorys/client-view/columns.ts:16-60`, `src/lib/kosztorys/client-view/settings.ts:25-36`, `src/lib/kosztorys/print/offer-columns.ts`

**Intent**:

- Add `currentPlannedQty` after `plannedQty`, and `currentPlannedNet` after `plannedNet`, in
  `CLIENT_VIEW_GROUPS` and `CLIENT_DOCUMENT_COLUMNS`.
- `currentPlannedQty` joins `DEFAULT_VISIBLE_COLUMNS`. `currentPlannedNet` does not: it is an
  available tick, unticked like Pozostało.
- `offer-columns.ts` maps both to print columns.

**Contract**: `PREVIEW_VISIBLE_COLUMNS` (the ceiling) gains `currentPlannedQty` and
`currentPlannedNet`. There is no gross twin on the investor document. Existing stored hidden sets
already carry `currentPlannedNet` from the Phase 1 migration, so the aktualizacja shows ticked
everywhere and its value unticked everywhere.

### Success Criteria:

#### Automated Verification:

- Before any etap entry, the investor set hides `remaining` and the aktualizacja pair. After one entry it shows them. The worker set is unchanged before an entry (new cases in the settlement-columns spec)
- The offer PDF before entries prints Opis, Przedmiar ofertowy, j.m., Cena j.m., Wartość netto przedmiar. After an entry it adds Aktualizacja przedmiaru: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/offer.test.ts`
- Default investor settings tick the aktualizacja and leave its value unticked (new case in the client-view settings spec)

#### Manual Verification:

- Podgląd for the investor on a kosztorys with no etap entries shows only the offer: no Aktualizacja, no Pozostało.
- After one etap entry, the podgląd and the share link show Przedmiar ofertowy and Aktualizacja przedmiaru. Its value can be ticked in the settings and is unticked by default. % wykonania follows aktualizacja.
- „Generuj ofertę” matches the podgląd in both states.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Worker surfaces

### Overview

The crew works to the current scope and never sees the offer. Every worker surface swaps ofertowy
for the aktualizacja under the same name, „Aktualizacja przedmiaru”.

### Changes Required:

#### 1. Worker document columns and settings

**File**: `src/lib/kosztorys/worker-view/columns.ts:17-58`, `src/lib/kosztorys/worker-view/settings.ts:41-53`, `kosztorys-worker-view-dialog.tsx:72,80`

**Intent**:

- `plannedQty` → `currentPlannedQty` in `WORKER_VIEW_GROUPS`, `WORKER_DOCUMENT_COLUMNS` and
  `PLANNED_COLUMNS` (the „Ukryj przedmiar…” toggle).
- The settings parse maps a stored `plannedQty` to `currentPlannedQty` in `hiddenColumns` and
  `columnRanks`. Otherwise an owner's stored untick is silently dropped and the column reappears.
- `plannedNetForPlane` / `remainingForPlane` already read the aktualizacja (Phase 2).

**Contract**: legacy key map `{ plannedQty: 'currentPlannedQty' }` applied on parse only.

#### 2. Prints and report surfaces

**File**: `src/lib/kosztorys/print/worker.ts:112,139`, `print/worker-columns.ts:54,62,67`, `print/worker-form-columns.ts:57-58`, `worker-view/summary.ts:94`, `report-column.tsx:95-96`, `worker-report-review.tsx:119`, `line-draft.ts:34`, `review-lines-table.tsx:234-241,487-493`

**Intent**: Each of these shows or computes against the resolved aktualizacja and is labelled with
the translated „Aktualizacja przedmiaru”. „Drukuj do wypełnienia” Postęp reads
`<done> / <aktualizacja>`.

### Success Criteria:

#### Automated Verification:

- Worker PDF and form print the aktualizacja under its label: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts src/__tests__/lib/kosztorys/print/worker-form.test.ts`
- A stored worker setting hiding `plannedQty` hides `currentPlannedQty` after parse (new case in the worker-view settings spec)
- The worker document never contains `plannedQty` (new case in the worker-view columns spec)

#### Manual Verification:

- A worker link (pl and uk) at 390px shows „Aktualizacja przedmiaru” (translated in uk) and never the ofertowy quantity. After a hand edit to 120 it shows 120.
- „Drukuj do wypełnienia” Postęp shows `done / 120`.
- The report page and the report review compare against the aktualizacja. Accepting an extra work creates a row with Przedmiar ofertowy 0 and Aktualizacja = the reported quantity.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: Docs and archive

### Overview

Record the durable rationale where it lives, and archive the folded change.

### Changes Required:

#### 1. Glossary and domain notes

**File**: `context/domain/02-glossary.md`, `context/reference/kosztorys-editor-domain-notes.md`

**Intent**:

- Glossary: add a row for „Aktualizacja przedmiaru” ↔ `currentPlannedQty` (null = follows). Fix
  the stale `przedmiar` drift cell (it says „—” while the code uses `plannedQty`).
- Domain notes: the anchor of Pozostało / % wykonania moved from the offer to the aktualizacja.
  This updates `:106-108`, P9 `:1677` and EX-494 `:607-622`.
- Domain notes: worker extras land as aktualizacja-only rows, which supersedes the „wykonane bez
  przedmiaru = ofertę trzeba uzupełnić” workaround at `:469-470`.
- Domain notes: record the no-sheet-parity status (lessons.md:325), and close P13 `:1765-1768`
  with the „oferta to oferta” ruling.

#### 2. Archive the folded change

**File**: `context/changes/2026-10-06-offer-hides-remaining/` → `context/archive/2026-10-06-offer-hides-remaining/`

**Intent**: Its decision is implemented in Phase 4.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check (prose only).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- **Red-first on split fixtures.** Every test of a progress figure uses a row with ofertowy 10,
  aktualizacja 15, executed 12. It must fail against the pre-change code. A fixture where the two
  are equal proves nothing.
- Resolver: `null` follows ofertowy, `0` stays 0.
- Policy: Delete → `null`, typed 0 → 0.
- Import: matched carry, new row `null`.
- Worker extra: ofertowy 0, aktualizacja = qty.
- Worker settings legacy-key map.

### Integration Tests:

- `insert-schema-drift`, `serialize-restore-roundtrip` and `kosztorys-tree-sql-drift` against the
  5435 test DB, after `pnpm db:migrate:test`.

### Manual Testing Steps:

1. The editor flow from Phase 3, on a local seeded kosztorys.
2. The investor podgląd before and after the first etap entry (Phase 4).
3. A worker link at 390px in uk (Phase 5).

E2E: none. The risks are calculation and rendering, covered at the unit/DOM layers. No
client → action → DB → revalidation path is new; the autosave path is the existing per-field one.

## Migration Notes

- Additive, nullable, no backfill. Existing kosztorysy follow ofertowy with no data change.
- Local: `pnpm payload migrate`. Test DB: `pnpm db:migrate:test`.
- Prod: `pnpm db:migrate:prod`, **human-run, before the push** (additive ordering).
- Run `git status src/migrations` before any migrate against a shared DB.

## Whole-tree Gate

Run once, after Phase 6.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- DB integration specs pass: `pnpm test:integration`

## References

- Research: `context/changes/2026-10-07-kosztorys-przedmiar-aktualny/research.md`
- Owner rulings: `context/changes/2026-10-07-kosztorys-przedmiar-aktualny/change.md`
- Writer precedent: `src/migrations/20261007_0_add_ai_review_columns.ts`, commit `b6d73462`
- Override precedent: `src/components/kosztorys/editor/grid/cells/subcontractor/price-cell.tsx`
- Folded change: `context/changes/2026-10-06-offer-hides-remaining/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model and writers

#### Automated

- [x] 1.1 Migration applies to the local DB — 9fb5d40a
- [x] 1.2 Migration applies to the test DB — 9fb5d40a
- [x] 1.3 Stored investor hidden sets carry currentPlannedNet; NULL rows stay NULL — 9fb5d40a
- [ ] 1.4 Insert funnel matches the table
- [ ] 1.5 Tree SELECT matches the mapper
- [ ] 1.6 Snapshot round-trip keeps a hand edit and restores an old snapshot as null
- [ ] 1.7 Import plan carries a hand edit on a matched row, null on a new row
- [ ] 1.8 Worker extra lands with ofertowy 0 and aktualizacja = reported quantity
- [ ] 1.9 Patch schema keeps null as null

### Phase 2: Calculation layer

#### Automated

- [ ] 2.1 Core calc / rows / column values / totals specs rewritten red-first on split fixtures — cdca77df (specs unrun)
- [ ] 2.2 Overrun and plane specs pass on split fixtures — cdca77df (specs unrun)
- [ ] 2.3 Row-condition filters read aktualizacja; client-empty needs both zero — cdca77df (specs unrun)
- [ ] 2.4 Section completionRatio uses aktualizacja, section offer stays ofertowy — cdca77df (specs unrun)
- [ ] 2.5 Prognoza unchanged when only aktualizacja differs — cdca77df (specs unrun)

### Phase 3: Editor columns

#### Automated

- [ ] 3.1 Policy: Delete → null, typed 0 → 0, undo restores null — c7290676 (specs unrun)
- [ ] 3.2 Cell renders grey for null, black for a stored value — c7290676 (specs unrun)
- [ ] 3.3 History diff lists an aktualizacja change — c7290676 (specs unrun)
- [ ] 3.4 Column registries accept the new ids — c7290676 (specs unrun)

### Phase 4: Investor document

#### Automated

- [ ] 4.1 Investor set hides remaining and the aktualizacja pair until the first entry; worker set unchanged
- [ ] 4.2 Offer PDF before / after the first entry
- [ ] 4.3 Default investor settings tick aktualizacja, leave its value unticked

### Phase 5: Worker surfaces

#### Automated

- [ ] 5.1 Worker PDF and form print the aktualizacja under its label
- [ ] 5.2 Stored worker hide of plannedQty maps to currentPlannedQty
- [ ] 5.3 Worker document never contains plannedQty

### Phase 6: Docs and archive

#### Automated

- [ ] 6.1 No phase-scoped automated check (prose only)
