# Katalog prac — Filtry / Problemy + raport użycia — Implementation Plan

## Overview

`/katalog-prac` gets the kosztorys editor's two reading menus (EX-863) and an on-click usage report
(EX-873):

- **„Problemy"** lists what is broken in a catalogue praca.
- **„Filtry"** narrows the table by how its stawki are set and whether they stay under the ceiling.
- A **„j.m."** filter sits next to „Kategoria".
- **„Policz użycia"** counts in how many kosztorysy each praca is used. It then adds a „Kosztorysy"
  column, an „Użycie" filter group, a „występuje z inną j.m." marker and a second list of used works
  that are missing from the catalogue.

## Current State Analysis

- The table (`src/components/work-catalogue/work-catalogue-data-table.tsx`) has search, a Kategoria
  multi-select and „Dodaj pracę". There are no conditions, no j.m. filter, no chip bar and no usage
  figures.
- The editor machinery exists, but it is typed on the rozpiska row:
  - the registry: `src/lib/kosztorys/row-conditions/*`, `problem-conditions.ts`
  - the models: `toolbar/menus/{filters,problems}-menu-model.ts`
  - the engaged-set store: `editor/hooks/use-engaged-conditions.ts`
  - the chip bar: `toolbar/kosztorys-active-filters-bar.tsx`
- The UI primitives are domain-free and reused unchanged: `FilterMultiSelect` (toggles mode),
  `DropdownCheckGroups`, `FilterTriggerButton`, `FilterChip`.
- The ceiling rule lives in `isOverCeiling` (`subcontractor-price-guard.ts:61`), with thresholds per
  plane: 65 % z narzędziami, 55,25 % bez narzędzi. The catalogue's złotówka-per-plane helper
  `rateAmount` is private to `src/components/tables/work-catalogue.tsx:49`, so a filter in `lib/`
  cannot reach it today.
- The match key is `catalogueKey` (`catalogue-key.ts:15`). It is stored on
  `work_catalogue_items.match_key` with 0 drift, and pozycje carry no key, so matching must run in
  Node.
- The hint scorer `closestEntries` (`build-catalogue-comparison.ts:49`) is private. Only
  `attachCatalogueHints` is exported, and it is typed on `CatalogueMissingT`.
- `DataTable` has `aboveToolbar` but no slot below the toolbar (`data-table.tsx:42-70`).

## Desired End State

On `/katalog-prac`:

1. **„Problemy"** (destructive trigger, shown only while something is wrong) offers:
   - „bez ceny j.m."
   - „stawka 0 zł z narzędziami"
   - „stawka 0 zł bez narzędzi"

   Picking one is exclusive and keeps only the matching prace.

2. **„Filtry"** (tick = visible, counts taken over the whole catalogue) offers, per plane:
   - source: „kwota" / „mnożnik" / „auto"
   - „ponad {limit}" / „w granicy", where the limit is 65 % z narzędziami and 55,25 % bez narzędzi,
     and „w granicy" excludes „auto" and prace bez ceny

   A condition with count 0 is hidden unless it is engaged. The engaged filters survive a reload.

3. **„j.m."** is a multi-select next to „Kategoria".
4. **A chip bar under the toolbar** names every active narrowing. Each chip is removable, and „Wyczyść
   wszystko" appears from 2 chips.
5. **„Policz użycia"** runs one read, then shows:
   - a sortable „Kosztorysy" column with the count of inwestycje (not pozycje);
   - a „występuje z inną j.m." marker on the rows it applies to;
   - an „Użycie" group in „Filtry" („nieużywane" / „używane"), which is not persisted;
   - a list „Używane, a brak w katalogu" under the table, grouped by key, sorted by kosztorys count,
     with „może chodzi o…" hints.

   Szablony and inwestycje in the kosz are excluded. Wyceny count.

Verification:

- node specs pin the conditions, counts and usage building;
- a DB spec pins the scope of the usage SQL;
- the editor's existing specs stay green across the shared extraction;
- manual checks cover the page.

### Key Discoveries:

- Problems are exclusive, filters stack, and both share one engaged store; `toggleExclusive(id,
within)` is what keeps them apart (`use-engaged-conditions.ts:60`).
- The ceiling cell and the filter must share one predicate, or the red cell and „ponad" disagree.
  That is why `rateAmount` moves to `lib/`.
- „Auto" has no share (`subcontractor-price-guard.ts:104-116`). A plain `!isOverCeiling` would count
  every auto praca as „w granicy".
- „Used" = `planned_qty > 0` OR `EXISTS stage_progress.qty_done > 0`, excluding `status = 'szablon'`
  and `trashed_at IS NOT NULL`. This predicate is `> 0`, not the `<> 0` in `KOSZTORYS_USED`
  (`investment-trash.ts:10-20`).
- A DB spec follows `src/__tests__/lib/db/investment-trash.db.test.ts`:
  - `describe.skipIf(!ENV_READY)` gets it picked up by `scripts/test-integration.sh`;
  - `createTestInvestment` + `createKosztorysTree` build the fixtures;
  - a name-prefix purge cleans up.

## What We're NOT Doing

- No „ostatnie użycie" / date column in any form (owner, 2026-09-29).
- No „wyłączników" / „włączników" folding. The owner decides that, and it changes catalogue identity.
- No usage from presets / szablony, and none from the legacy sheets.
- No fuzzy matching in the count. Hints are advice only and never add to „Kosztorysy".
- No generic condition registry shared with the editor. The catalogue gets its own small one.
- No extraction of the menu-model core (count + hide-at-0-unless-engaged): it is 2 lines per model,
  and a helper's parameters would restate them.
- No caching of the usage read. It is on a click and freshness is its point.
- No schema change and no migration.
- No „Policz" on the kosztorys editor's catalogue dialog. This is the catalogue page only.

## Implementation Approach

1. **Shared plumbing first**, extracted out of the editor behind its current signatures, so the
   editor's specs prove the extraction:
   - the engaged-id store keyed by storage key;
   - the presentational chip bar;
   - a `belowToolbar` slot on `DataTable`;
   - the catalogue ceiling helpers moved to `lib/`.
2. **EX-863** on top of that:
   - a React-free catalogue condition registry with counts and apply, in
     `src/lib/kosztorys/work-catalogue/`;
   - two menu models beside the table;
   - wiring in the data table.
3. **EX-873's data plane**: one SQL statement in `lib/db`, pure matching and grouping in `lib/`, and a
   `'use server'` query in its own file.
4. **The usage UI**, all of it keyed off one client-side `usage` state that is `null` until the click.

The usage filter ids live in plain React state, not the persisted store. After a reload there is no
usage map, so a restored „nieużywane" would narrow by a figure that does not exist.

## Critical Implementation Details

- **Filter order does not matter; count order does.** Conditions, search, Kategoria and j.m. all
  combine with AND. Every condition count is taken over `data` (the whole catalogue), never over the
  narrowed rows, so a count never moves when another control moves.
- **One ceiling predicate.** `isCatalogueOverCeiling(entry, plane)` is the only way anything asks
  whether a catalogue praca is over the ceiling. The table's red share cell and the „ponad" /
  „w granicy" conditions all call it.
  - „w granicy" = source ≠ auto AND `clientPrice > 0` AND not over.
  - So on one plane, „ponad" + „w granicy" + „auto" + (non-auto bez ceny) partition the catalogue.
    A node spec pins that.
- **cmdk labels must be unique within one menu.** „auto" appears once per plane, so each row label
  carries its plane, or the group heading does and the label includes it. Follow the editor's
  plane-row labelling.

## Phase 1: Shared plumbing

### Overview

Extract what the catalogue needs from the editor, without changing editor behaviour.

### Changes Required:

#### 1. Engaged-id store keyed by storage key

**File**: `src/hooks/use-engaged-ids.ts` (new); `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts`

**Intent**: The toggle / toggleExclusive / setMany / clear store stops being bound to an investment
id, so the catalogue can persist its own set. The editor hook becomes a one-line wrapper. The
module-scope store cache moves with it, and so does the rationale in its comments.

**Contract**: `useEngagedIds(storageKey: string): { engagedIds, toggle, toggleExclusive, setMany, clear }`.
`useEngagedConditions(investmentId)` = `useEngagedIds('kosztorys-filters:' + investmentId)`, with an
unchanged signature and an unchanged key. It lives in `src/hooks/` because it has two consumer
directories.

#### 2. Presentational chip bar

**File**: `src/components/filters/active-filters-bar.tsx` (new); `src/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.tsx`

**Intent**: The wrap row of `FilterChip`s, plus „Wyczyść wszystko" from 2 chips, becomes one
presentational component. The editor bar keeps its model and its `remove` switch, and renders the
shared bar.

**Contract**: `ActiveFiltersBar({ chips: { id, label, count?, removeLabel }[], onRemove(id), onClearAll, className? })`.
It returns `null` for an empty list. Padding comes from the caller: the editor's `px-4 pb-2` stays
the editor's.

#### 3. Slot below the toolbar

**File**: `src/components/tables/data-table/data-table.tsx`

**Intent**: Somewhere to put the catalogue's chip bar, directly under the toolbar and above the
table.

**Contract**: optional `belowToolbar?: React.ReactNode`, rendered right after `toolbar?.(…)`.

#### 4. Catalogue ceiling helpers in `lib/`

**File**: `src/lib/kosztorys/work-catalogue/catalogue-rate.ts`; `src/components/tables/work-catalogue.tsx`

**Intent**: The filter and the red cell must read one predicate. Move `rateAmount` out of the
columns file and add the ceiling check beside it. Move its why-comment with it.

**Contract**:

- `catalogueRateAmount(entry, plane): number | null`
- `isCatalogueOverCeiling(entry, plane): boolean` = `isOverCeiling(catalogueRateAmount(entry, plane), entry, plane)`

The columns file imports both.

### Success Criteria:

#### Automated Verification:

- Editor specs stay green:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-engaged-conditions.test.tsx src/__tests__/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.test.tsx`
- `catalogue-rate` spec extended for `catalogueRateAmount` / `isCatalogueOverCeiling` (kwota, mnożnik,
  auto → never over, cena 0 → never over):
  `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-rate.test.ts`

#### Manual Verification:

- Kosztorys editor: the filters still persist per inwestycja, the chip bar looks and behaves as
  before, and „Wyczyść wszystko" still appears only from 2 chips.
- The catalogue table's red share cells are unchanged.

---

## Phase 2: Filtry / Problemy / j.m. on the catalogue (EX-863)

### Overview

A catalogue condition registry and its two menus, the j.m. filter and the chip bar, wired into the
table.

### Changes Required:

#### 0. Test-plan risk

**File**: `context/foundation/test-plan.md`

**Intent**: The catalogue page has no risk row, so add one (via `/10x-test-plan`) before writing its
specs.

**Contract**: A new risk #14, roughly: „Katalog prac mówi nieprawdę o sobie — filtr/problem liczy
inaczej niż pokazuje komórka, albo raport użycia liczy szablony / kosz lub pozycje zamiast
kosztorysów." It points at the specs in phases 2–3.

#### 1. Catalogue condition registry

**File**: `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts` (new)

**Intent**: A declarative list of catalogue conditions, plus the two pure functions the table
needs. It is React-free, so it is tested in node.

**Contract**:

- `CatalogueConditionT = { id: string; kind: 'filter' | 'problem'; group: string; label: string; matches(entry: WorkCatalogueItemT): boolean }`
- Literal ids, which are persisted:
  - `catalogue-no-price`
  - `catalogue-zero-rate-w_tools` / `catalogue-zero-rate-own_tools`
  - `catalogue-source-{amount|coeff|auto}-{plane}`
  - `catalogue-over-ceiling-{plane}` / `catalogue-within-ceiling-{plane}`
- Usage conditions `catalogue-usage-{unused|used}` are built by a function that takes the usage map
  (Phase 4), not declared statically.
- `countCatalogueConditions(rows, conditions): Map<string, number>`
- `applyCatalogueConditions(rows, conditions, engagedIds)`: engaged filters hide their matches (AND);
  an engaged problem keeps only its matches.
- Predicates:
  - „stawka 0" = source ≠ auto AND `catalogueRateAmount === 0`
  - „bez ceny" = `!(clientPrice > 0)`
  - source = `catalogueSourceOf(catalogueRateFor(entry, plane))`
  - ceiling = `isCatalogueOverCeiling`, with „w granicy" as defined in Critical Implementation Details
- Labels read `clientShareCeilingLabel(plane)` and `PLANE_LABELS` / `PRICE_SOURCE_LABELS`, never a
  literal „65 %".
- `PROBLEM_IDS`-style export of the problem ids, for `toggleExclusive`.

#### 2. Menu models + menus

**File**: `src/components/work-catalogue/catalogue-filters-menu-model.ts`, `catalogue-problems-menu-model.ts`, `catalogue-filters-menu.tsx`, `catalogue-problems-menu.tsx` (new)

**Intent**: The same semantics as the editor models:

- rows grouped by `groupLabel`, labelled `„… (n)"`;
- count 0 hidden unless engaged;
- filter `active = !engaged`, problem `active = engaged`.

The menus render `FilterMultiSelect` in toggles mode with `togglesBulk` and a reset, and a
`DropdownCheckGroups` problems dropdown with a destructive `FilterTriggerButton`, returning `null`
when empty. Both use `GRID_FILTER_TRIGGER_CLASS`, because the toolbar's filters slot is a
`ControlGrid`.

**Contract**:

- `catalogueFiltersMenuModel({ conditions, engagedIds, counts }): FilterToggleT[]`
- `catalogueProblemsMenuModel({ engagedIds, counts }): ProblemToggleT[]`
- Both reuse the editor's toggle types, which move to `src/components/filters/` if importing them
  from `kosztorys/editor` would point a catalogue file into the editor tree.
- The Problemy menu carries only „Zresetuj filtry". There is no „Odśwież", because nothing is held
  in place on this page.

#### 3. j.m. options

**File**: `src/lib/kosztorys/work-catalogue/category-options.ts`

**Intent**: The option list for the j.m. multi-select, built the same way as Kategoria. An empty
j.m. gets its own option, so picking any j.m. cannot strand those prace.

**Contract**: `catalogueUnitOptions(items)` → `{ value, label }[]`, with `''` labelled „bez j.m."
(the wording `CandidateRow` already uses).

#### 4. Wiring

**File**: `src/components/work-catalogue/work-catalogue-data-table.tsx`; `src/components/work-catalogue/catalogue-active-filters-model.ts` (new)

**Intent**: Chain the table's filters and add the new controls.

**Contract**:

- Pipeline: `data` → `applyCatalogueConditions` → search → Kategoria → j.m. → deferred.
- Counts come from `countCatalogueConditions(data, …)`.
- The engaged set comes from `useEngagedIds('work-catalogue-filters')`.
- A second `useClientMultiFilter` handles j.m.
- `filters` slot: Kategoria, j.m., Filtry, Problemy, spinner.
- `belowToolbar`: `ActiveFiltersBar`, fed by a small model. It emits:
  - „Ukryto: …" for each engaged filter;
  - „Tylko: …" for the engaged problem;
  - a „Szukaj" chip;
  - one chip each for Kategoria and j.m. when narrowed.

  „Wyczyść wszystko" clears all of them.

- The `aboveToolbar` count keeps counting `filteredData`.
- Replace the comment at lines 36-37, which describes the old pipeline.

### Success Criteria:

#### Automated Verification:

- Registry spec, `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-conditions.test.ts`:
  - each predicate;
  - the per-plane partition (ponad + w granicy + auto + non-auto bez ceny = all);
  - counts over the whole dataset;
  - filters combine with AND, the problem keeps only its matches;
  - an unknown engaged id is ignored.
- Model specs, `pnpm exec vitest run src/__tests__/components/work-catalogue/`:
  - count 0 hidden, engaged at (0) kept;
  - polarity;
  - problems list empty → menu hidden;
  - chip model covers every source.
- `category-options` spec extended for `catalogueUnitOptions`.

#### Manual Verification:

- „Problemy" appears only while a praca has no cena / a zero stawka, and picking one narrows to
  exactly those.
- Filtry counts don't move when search, Kategoria or j.m. change.
- „ponad 55,25 %" on bez narzędzi selects exactly the red share cells in that column.
- The filters survive a reload. Chips remove one by one, and „Wyczyść wszystko" clears everything.

---

## Phase 3: Usage read (EX-873 data)

### Overview

One SQL read of the used pozycje, pure matching and grouping, and an on-demand query.

### Changes Required:

#### 1. SQL

**File**: `src/lib/db/catalogue-usage.ts` (new)

**Intent**: The statement and its row mapper, nothing else.

**Contract**: `selectUsedKosztorysItems(db): Promise<{ investmentId: number; description: string; unit: string | null }[]>`.
The SQL is the one in research §4, with the szablon constant bound from `TEMPLATE_INVESTMENT_STATUS`,
not a literal.

#### 2. Matching and grouping

**File**: `src/lib/kosztorys/work-catalogue/catalogue-usage.ts` (new); `build-catalogue-comparison.ts`

**Intent**: Turn the used pozycje plus the catalogue into the report.

- Exact key → the set of distinct inwestycje.
- Catalogue rows whose folded opis appears in use under another j.m.
- Used keys missing from the catalogue, grouped, with hints.

Export a hint function that takes a bare opis, so this file does not dress rows up as
`CatalogueMissingT`.

**Contract**:

- `buildCatalogueUsage(used, catalogue): CatalogueUsageT`, where
  `CatalogueUsageT = { byId: Record<number, number>; otherUnitIds: number[]; uncatalogued: { key; description; unit; kosztorysCount; hints: CatalogueHintT[] }[] }`
- `byId` = catalogue id → distinct inwestycje. Catalogue prace absent from it are unused.
- Match against the stored `entry.matchKey`, fold the pozycje with `catalogueKey`.
- `uncatalogued` is sorted by `kosztorysCount` descending, then opis. Its display
  description / unit is the most frequent spelling in the group.
- `closestEntries` is exported from `build-catalogue-comparison.ts`, or wrapped as
  `hintsForDescription(description, candidates)` with `hintCandidates` exported beside it, so the
  folding and bigramming of the catalogue still happens once per report.
- Plain objects / arrays only, because the result crosses the server-action boundary.

#### 3. On-demand query

**File**: `src/lib/queries/catalogue-usage.ts` (new)

**Intent**: The `'use server'` read the button calls, gated like the page.

**Contract**: `countCatalogueUsage(): Promise<ActionResultT<CatalogueUsageT>>` via `protectedAction`
with `ADMIN_OR_OWNER_MANAGER_ROLES`. It reads the catalogue fresh (`listCatalogueItems`), not through
the cached `getWorkCatalogue`, so a praca added a moment ago is counted. It does no revalidation.

### Success Criteria:

#### Automated Verification:

- Node spec, `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-usage.test.ts`:
  - two pozycje in one inwestycja count 1;
  - the same key in two inwestycje counts 2;
  - a typo-fixed opis still matches, which proves the TS folding runs;
  - „inna j.m." is flagged;
  - uncatalogued groups are ordered and carry hints;
  - an unrelated opis gets no hint.
- DB spec, `pnpm exec vitest run src/__tests__/lib/db/catalogue-usage.db.test.ts`, following
  `investment-trash.db.test.ts`. Included: Przedmiar > 0, Przedmiar 0 with an etap qty > 0, a wycena.
  Excluded: an all-zero pozycja, a szablon inwestycja, an inwestycja in the kosz.

#### Manual Verification:

- None at this phase. It has no UI.

---

## Phase 4: Usage UI (EX-873)

### Overview

The button and everything it reveals.

### Changes Required:

#### 1. Button and state

**File**: `src/components/work-catalogue/count-usage-button.tsx` (new); `work-catalogue-data-table.tsx`

**Intent**: „Policz użycia" in the toolbar `actions`, next to „Dodaj pracę". Both live under the
page's single role gate, so lesson ~1149 does not bite. It is pending while the read runs; a
re-click recounts. Errors go through the app's existing notice/toast path.

**Contract**:

- The table holds `usage: CatalogueUsageT | null`, which is `null` until the first success.
- Usage filter ids are held in `useState`, not in the persisted store.

#### 2. Column and marker

**File**: `src/components/tables/work-catalogue.tsx`

**Intent**: A „Kosztorysy" column appears only when `usage` is set. It is right-aligned and sortable,
and 0 renders as „0" so it sorts to the top ascending. A small muted marker „występuje z inną j.m."
sits on the opis cell of the `otherUnitIds` rows.

**Contract**:

- `getWorkCatalogueColumns({ …, usage })`, with the column id `kosztorysCount`.
- The column is appended rather than placed by `storageKey` ranks it has never seen.

Check how `ColumnToggle` / ranks treat an id that appears late. If it breaks the order persistence,
render the column always and show „—" before the click instead.

#### 3. „Użycie" group

**File**: `catalogue-conditions.ts`; `catalogue-filters-menu-model.ts`; the chip model

**Intent**: Two filter conditions built from `usage.byId`: „nieużywane" (count 0 / absent) and
„używane". They enter the same menu under the heading „Użycie", with counts, and add chips, but they
are engaged through the non-persisted state.

**Contract**: `catalogueUsageConditions(usage): CatalogueConditionT[]`. It returns `[]` while
`usage` is `null`, so the group does not exist before the click.

#### 4. „Używane, a brak w katalogu" list

**File**: `src/components/work-catalogue/uncatalogued-usage-list.tsx` (new); `src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx`

**Intent**: A read-only list under the table, collapsed behind its heading with the count:

- per group: opis, j.m., the kosztorys count;
- under it, the hint lead and the candidate rows.

Extract `CandidateRow` + `hintLead` into a shared file rather than copying them. The new list uses
their read-only form.

**Contract**:

- The shared file sits beside `catalogue-missing-list.tsx` (e.g. `catalogue-candidate-row.tsx`),
  since the editor dialog stays its first consumer. Move it to `src/components/work-catalogue/` if
  lint or dependency direction objects.
- `hintLead` takes `{ description, hints }` instead of `CatalogueMissingT`.

### Success Criteria:

#### Automated Verification:

- Registry spec extended: usage conditions are empty for `null`, and unused/used partition the
  catalogue.
- DOM spec, `pnpm exec vitest run src/__tests__/components/work-catalogue/uncatalogued-usage-list.test.tsx`:
  it renders the groups in order with their kosztorys counts, and a group with no hints renders
  none.
- The editor's catalogue-missing-list specs, if any exist, stay green after the extraction.

#### Manual Verification:

- Before the click there is no „Kosztorysy" column, no „Użycie" group and no list.
- After the click, the „Kosztorysy" figures agree with a hand count for 2–3 prace.
- „nieużywane" narrows to 0-count prace. After a reload the group is gone and nothing stays
  narrowed by it.
- A praca with the same opis under another j.m. shows the marker.
- The list is ordered by count, and a hint is never counted into „Kosztorysy".
- A new kosztorys that uses a praca raises its count on the next click.

---

## Phase 5: Docs

### Overview

The living docs the change makes stale or incomplete.

### Changes Required:

#### 1. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: A short section on the catalogue page's Filtry / Problemy, and on the usage report's
definition of „used", its scope and its count unit. It says why the usage filter is not persisted
and why hints never count.

**Contract**: A new section after the Filtry / Problemy section (≈ l.1258).

#### 2. Change record

**File**: `context/changes/2026-09-28-catalogue-filters-and-usage/change.md`

**Intent**: Correct „ponad 65 %" to the per-plane limit and record the „w granicy excludes auto"
ruling.

**Contract**: Edits to the „Decyzje 2026-09-29" bullets.

### Success Criteria:

#### Automated Verification:

- None. This phase is prose only.

#### Manual Verification:

- The domain notes describe what the page does.

## Testing Strategy

### Unit Tests:

- Catalogue condition predicates and the per-plane partition.
- Counts taken over the whole dataset.
- Apply semantics: filters AND, one problem kept exclusively.
- Menu models: the hide-at-0 rule and polarity.
- Chip model.
- Usage building: distinct inwestycje; matching after typo folding; „inna j.m."; uncatalogued
  ordering and hints.

### Integration Tests:

- `catalogue-usage.db.test.ts`: the SQL's inclusion and exclusion. The kosz exclusion can only be
  proved here, because the local copy has 0 inwestycje in the kosz.

### Manual Testing Steps:

1. Open `/katalog-prac` as OWNER. Check the Problemy counts against the known local figures: 20 bez
   ceny, 18 / 21 stawka 0.
2. Engage „ponad" on both planes and compare against the red cells.
3. Click „Policz użycia". Expect about 177 / 561 used and about 229 uncatalogued groups on the local
   copy.
4. Reload, and confirm the plain filters persisted while the Użycie group is gone.

## Performance Considerations

- The usage read is about 2 ms of SQL and about 0.4 s of hint scoring. That is on a click with a
  pending state, so it needs no cache.
- Condition counts over 561 rows run on each render. React Compiler memoises them on `data` and the
  conditions. No hand `useMemo` unless profiling says so.

## Migration Notes

None. There is no schema change.

## Whole-tree Gate

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Integration specs, as the DB leg of pre-push: `pnpm test:integration`

The full unit suite runs only when asked (memory: no full suite unasked). Pre-push runs it anyway.

## References

- Research: `context/changes/2026-09-28-catalogue-filters-and-usage/research.md`
- Editor pattern: `src/components/kosztorys/editor/toolbar/menus/{filters,problems}-menu-model.ts`,
  `kosztorys-active-filters-bar.tsx`, `editor/hooks/use-engaged-conditions.ts`
- DB spec pattern: `src/__tests__/lib/db/investment-trash.db.test.ts`
- Hints: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:40-66,235-242`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared plumbing

#### Automated

- [x] 1.1 Editor engaged-conditions + active-filters-bar specs stay green — f5e05c0e
- [x] 1.2 catalogue-rate spec covers catalogueRateAmount / isCatalogueOverCeiling — f5e05c0e

### Phase 2: Filtry / Problemy / j.m. on the catalogue (EX-863)

#### Automated

- [x] 2.1 catalogue-conditions spec (predicates, per-plane partition, counts, apply) — 2086fa3b
- [x] 2.2 catalogue menu-model + chip-model specs — 2086fa3b
- [x] 2.3 category-options spec covers catalogueUnitOptions — 2086fa3b

### Phase 3: Usage read (EX-873 data)

#### Automated

- [x] 3.1 catalogue-usage node spec (distinct inwestycje, folding, inna j.m., uncatalogued + hints) — 51c181ab
- [x] 3.2 catalogue-usage DB spec (inclusion / exclusion incl. szablon, kosz, wycena) — 51c181ab

### Phase 4: Usage UI (EX-873)

#### Automated

- [x] 4.1 Usage conditions empty before the click, partition after — 9c21694b
- [x] 4.2 uncatalogued-usage-list DOM spec — 9c21694b
- [x] 4.3 Editor catalogue-missing-list specs stay green after the CandidateRow extraction — 9c21694b

### Phase 5: Docs

#### Automated

- [x] 5.1 No automated check — prose only — b6b1dd1b
