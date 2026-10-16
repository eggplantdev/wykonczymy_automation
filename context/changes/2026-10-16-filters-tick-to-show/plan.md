# Filters: tick what you want to see — Implementation Plan

## Overview

Every „Filtry"-style menu in the app works one way: **a tick narrows to what it names; nothing ticked
shows everything.** Inside one group, ticks combine with OR. Between groups, they combine with AND.

This reverses the EX-665 grammar (`c6c32570d`, 2026-08-14), where every option started ticked and an
untick hid what it matched. The owner ruled on 2026-10-16 that unticking to narrow is misleading.

Hard requirement: **every filter result reachable today stays reachable.**

## Current State Analysis

### Kosztorys editor and szablon „Filtry"

- Registry: `src/lib/kosztorys/row-conditions/registry.ts`. Groups: `src/lib/kosztorys/filter-groups.ts`.
- Engine: `applyRowConditions` (`row-conditions/queries.ts:23`). A row is hidden if it matches **any**
  engaged (unticked) filter. Groups are headings only and play no part in the logic.
- Menu: `filtersMenuModel` sets `active: !engaged`. `useKosztorysFilterMenu` adds a bulk
  „Zaznacz/Odznacz wszystkie" row. `KosztorysFiltersMenu` uses the intro „Widoczne pozycje / Odznacz,
  żeby ukryć." and its trigger counts unticked entries.
- Chips: `active-filters-model.ts:37` reads „Ukryto: pozycje …". Empty grid: `empty-grid-copy.ts`
  („Wszystkie pozycje schowane", „odznacz je w menu").
- Storage: localStorage `kosztorys-filters:<id>` / `szablon-filters:<id>` (`use-engaged-conditions.ts`).
  The same store holds the „Problemy" picks.
- „Przegląd AI": `pickAiReview` (`use-kosztorys-view-state.ts:88-93`) engages `no-planned-or-ai-qty`
  (an untick). `isFoldSuppressed` exempts that one id from the fold suppression.
- `inertUnderGlobalDiscount`: under a global rabat, the rabat pair's `matches` returns false, so a
  persisted untick hides nothing.

### Work catalogue „Filtry"

- Conditions and engine: `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts`. An engaged filter
  hides its matches; an engaged problem keeps only its matches; all of them AND together.
- Menu: `catalogue-filters-menu.tsx` + `catalogue-filters-menu-model.ts`. Chips:
  `catalogue-active-filters-model.ts`.
- Storage: localStorage `work-catalogue-filters`.

### Option lists (`FilterMultiSelect` `options` mode, 13 consumers)

- `[]` means no filter and renders **all ticked**; unticking narrows. `[FILTER_NONE]` means nothing
  visible.
- The bulk row reads „Zaznacz/Odznacz wszystkie".
- `kosztorys-sections-menu.tsx` is not a filter: there a tick means „sekcja rozwinięta".

### Already tick-to-see, with one gap each

- Users „Pracownicy" (`use-user-list-filters.ts`): ticking neither option shows nothing.
- Investments `status-filter.tsx`: an explicit all-false selection shows nothing.

### Partition audit — the „no filter lost" proof

The flip loses nothing as long as each group is a partition of the rows: the options are mutually
exclusive and together cover every row. Then „untick S" today equals „tick the rest of the group"
tomorrow, and AND between groups is unchanged. The only thing that goes is the useless „everything
unticked → empty" state.

| Group today | Partition? | Fix |
| --- | --- | --- |
| Kosztorys „Przegląd AI" pair | yes (while the view is on) | none |
| Kosztorys „Przedmiar i wykonana praca" (6 options) | three overlapping pairs | split into 3 groups, one pair each |
| Kosztorys „Źródło stawki wykonawcy" (3 options × 2 planes) | yes per plane; the planes overlap | split per plane |
| Kosztorys „Udział wykonawcy w cenie" (2 × 2 planes) | yes per plane | split per plane |
| Kosztorys Komentarz, Rabat pairs | yes | none (Rabat needs inert handling, see Phase 1) |
| Catalogue „Źródło stawki" (3 × 2 planes) | yes per plane | split per plane |
| Catalogue „Udział w cenie" (over / within per plane) | **not exhaustive** — auto and unpriced rows are in neither | add a residual option per plane, plus split per plane |
| Option lists | each option is a value, so trivially a partition | none |

Without the catalogue residual option, today's „untick ponad 65%" (which leaves w granicy + auto +
unpriced) would become unreachable.

## Desired End State

- **Kosztorys, szablon and work catalogue „Filtry"**
  - Nothing is ticked on open.
  - Ticking „Z komentarzem" shows only pozycje with a comment, and its chip reads „Tylko: pozycje z
    komentarzem".
  - Ticking „Z komentarzem" and „Z rabatem" shows pozycje with both.
  - Ticking both halves of a pair shows everything.
  - No single group can empty the grid.
  - Ticking a rate option reveals that plane's price columns.
- **Option lists:** nothing is ticked when unfiltered, ticking narrows, and „Wyczyść" clears.
- **„Sekcje"** looks and behaves exactly as today.
- **„Problemy"** is unchanged.
- **Verification:** a unit test per registry proves every filter group is a partition over a fixture
  set. Equivalence tests show today's hide-sets are reproduced by ticking the complement.

### Key Discoveries

- `priceSourceOf` returns `'auto' | 'coeff' | 'amount'` only (`calc.ts:63-76`, `types.ts:69`), so the
  per-plane source split is exhaustive.
- The kosztorys „within ceiling" option is exactly `!over` (`registry.ts:228,255`), so it is exhaustive.
- `isEmptyOnBothAxes` checks ofertowy **and** aktualny przedmiar, while `no-planned-qty` checks only
  aktualny (`registry.ts:25-26,96`). So the „Puste pozycje" pair is **not** equal to „bez przedmiaru"
  AND „bez wykonanej pracy", and it must stay its own group.
- The kosztorys store also holds „Problemy" picks. Changing the key drops those too, which costs a
  pick and nothing else.
- `FilterMultiSelect.flush` today turns a full selection into `[]`. Under the new model, ticking the
  last option would then wipe every tick off the screen, so `flush` must emit the ids as ticked.
- The sections menu never passes `[]` (it passes an explicit list or `FILTER_NONE`), so it survives
  the display flip once its `onValuesChange` reads `[]` as „collapse all".

## What We're NOT Doing

- „Problemy" menus: already show-only and single-select.
- „Sekcje" semantics: a tick still means expanded.
- Users „Pozostało do wypłaty": a „which money to count" switch, not a row filter, and already
  tick-to-count.
- Hide-wording outside filter menus: „Ukryj zakończone" etapy, „Ukryj zweryfikowane", „Ukryj już
  dodane", column pickers.
- Migrating saved picks: the old engaged ids mean the opposite, so they are dropped by a key change.
- Server parsing of `__none__` in URLs: kept as is, so a stale bookmarked URL still means „nothing".
- The pre-existing transfers mismatch (CANCELLATION shown ticked while `showCancelled` is off).

## Implementation Approach

Keep the engaged-ids store and the `matches` predicates; flip what an engaged id means from „hide" to
„include". Groups become real facets in the engine. Regroup until every group is a partition (the
partition test is the guard).

UI changes follow from `active = engaged`. The option-list flip lives in one primitive
(`FilterMultiSelect`); its one non-filter consumer (sections) gets a small adapter fix.

## Critical Implementation Details

- **Inert rabat under a global rabat.** Today an engaged rabat filter hides nothing because `matches`
  is false. Under include semantics a false `matches` empties the grid. So drop
  `inertUnderGlobalDiscount` ids from the effective engaged set when a global rabat is active, the
  same way `editorConditionIds` already drops „Przegląd AI" ids while the view is off.
- **„Przegląd AI" switch-on (owner ruling 2026-10-07: open on priced work).** It becomes „engage
  `has-planned-or-ai-qty`, disengage `no-planned-or-ai-qty`". The `isFoldSuppressed` exemption moves
  to the `has-` id.

## Phase 1: Kosztorys engine and registry facets

### Overview

Turn engaged „filter" conditions into facets (OR within a group, AND between groups) and regroup the
registry into partitions. TDD: the equivalence and partition specs come first.

### Changes Required

#### 1. Filter groups

**File**: `src/lib/kosztorys/filter-groups.ts`

**Intent**: Replace `quantities`, `rate-source` and `rate-ceiling` with partition-sized groups.

**Contract**: The new ids, in this order:

- `ai-review`
- `planned` „Przedmiar"
- `measured` „Wykonana praca"
- `filled` „Puste pozycje"
- `rate-source-w-tools`, `rate-source-own-tools` — „Źródło stawki wykonawcy" + plane dash suffix
- `rate-ceiling-w-tools`, `rate-ceiling-own-tools` — „Udział wykonawcy w cenie" + plane dash suffix
- `note`
- `discount`

`FilterGroupIdT` follows from the list.

#### 2. Registry

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: Point each filter at its new group. Plane-split options drop the plane suffix from
`menuLabel`, since the heading now names the plane. `label`, used by chips, keeps the suffix.

**Contract**: Condition ids do not change. The pair predicates do not change.

#### 3. Engine and types

**File**: `src/lib/kosztorys/row-conditions/queries.ts`, `row-conditions/types.ts`

**Intent**:

- `applyRowConditions`: a row passes when, for every group with at least one engaged filter, it
  matches one of that group's engaged filters. `client` stays a hider. `diagnostic` stays a keeper.
  The latch is unchanged.
- `editorConditionIds` gains a `globalDiscountActive` argument that strips inert ids.
- `isFoldSuppressed` exempts `HAS_PLANNED_OR_AI_QTY_CONDITION_ID`.
- `engagedHiders` splits into `engagedFilters` (filter kind) and `engagedClientHiders` (client kind).

**Contract**:

- `editorConditionIds(persisted, aiReview, globalDiscountActive)`.
- Rewrite the type comments on `FilterConditionT` and `inertUnderGlobalDiscount` to say „a tick
  includes".

#### 4. Specs (written first)

**File**: `src/__tests__/lib/kosztorys/row-conditions/queries.test.ts`,
`src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`

**Intent**:

- **Partition spec:** over a fixture covering every axis value, each filter group's conditions match
  every row exactly once. Run it with `aiColumnsShown: true` and no global rabat.
- **Equivalence spec:** for representative old hide-sets, the old result equals the new engine run on
  the per-group complement. Cases:
  - „untick bez przedmiaru + bez wykonanej pracy" == tick „z przedmiarem" + „z wykonaną pracą"
  - „untick Auto (w) + Auto (own)" == tick the other two per plane
  - a „Puste pozycje" untick
- **Facet behaviour:** both halves of a pair ticked shows all rows. AND across groups. Inert rabat
  under a global rabat is stripped. A diagnostic keeper still applies alongside facets.

### Success Criteria

#### Automated Verification

- Facet, partition and equivalence specs pass:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/`
- Existing consumers of the engine still pass: `pnpm exec vitest run
  src/__tests__/lib/kosztorys/client-document-subtotals.test.ts
  src/__tests__/lib/kosztorys/measure-discrepancy.test.ts`

#### Manual Verification

- (covered in Phase 2, where the UI exists)

**Implementation Note**: commit when automated verification passes and continue.

---

## Phase 2: Kosztorys and szablon „Filtry" UI

### Overview

Make the menu, chips, empty state, „Przegląd AI" switch and storage speak the tick-to-see grammar.

### Changes Required

#### 1. Menu model, hook and menu

**File**: `toolbar/menus/filters-menu-model.ts`, `toolbar/menus/use-kosztorys-filter-menu.ts`,
`toolbar/menus/kosztorys-filters-menu.tsx`

**Intent**:

- Set `active: engaged`.
- List an option when it is engaged, or when `0 < count < rowCount`. An option matching every row
  (or none) would change nothing if ticked.
- Remove `togglesBulk`: ticking everything equals ticking nothing.
- The trigger counts engaged filters.
- Intro: heading „Pokaż tylko", hint „Zaznacz, co chcesz widzieć. Nic nie zaznaczone — widać wszystko."

**Contract**:

- `filtersMenuModel` takes a `rowCount`; the hook passes the kosztorys row count from context.
- `FilterToggleT.active` comment: „ticked = narrows to it".

#### 2. Chips and empty grid

**File**: `toolbar/active-filters-model.ts`, `src/lib/kosztorys/empty-grid-copy.ts`,
`kosztorys-editor-body.tsx`

**Intent**:

- Filter chip: label „Tylko: pozycje {label}", removeLabel „Przestań pokazywać tylko pozycje {label}".
- Empty state with engaged filters: title „Brak pozycji spełniających filtry", description „Filtry
  pokazują tylko pozycje {labels}." When more than 3 are engaged: „{n} filtrów zawęża pozycje — zmień
  je w menu „Filtry"."
- The client-hider branch and the preview copy are unchanged.

**Contract**: `emptyGridCopy` args become `filters` + `clientHiders` + `diagnostics`.

#### 3. „Przegląd AI" switch and storage key

**File**: `hooks/use-kosztorys-view-state.ts`, `hooks/use-engaged-conditions.ts`

**Intent**:

- `pickAiReview` engages `has-planned-or-ai-qty` and disengages `no-planned-or-ai-qty`.
- Pass `globalDiscountActive` to `editorConditionIds`.
- Rename the storage prefixes to `kosztorys-show:` / `szablon-show:`, so saved picks with the old
  meaning are dropped.

**Contract**: The storage prefixes change; nothing else reads them.

#### 4. Specs

**File**: `src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts`,
`.../menus/kosztorys-filters-menu.test.tsx`, `.../toolbar/active-filters-model.test.ts`,
`.../toolbar/kosztorys-active-filters-bar.test.tsx`, `src/__tests__/lib/kosztorys/empty-grid-copy.test.ts`,
`src/__tests__/lib/kosztorys/row-conditions/ai-review-conditions.test.ts`

**Intent**: Update the expectations to the new grammar:

- `active = engaged`
- no bulk row
- trigger shows the engaged count
- „Tylko:" chips
- new empty copy
- the AI switch engages the `has-` id
- an option matching every row is not listed

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/ src/__tests__/lib/kosztorys/empty-grid-copy.test.ts src/__tests__/lib/kosztorys/row-conditions/ai-review-conditions.test.ts`

#### Manual Verification

- **Kosztorys „Filtry" basics:** open „Filtry" on a kosztorys. Nothing is ticked, the header reads
  „Pokaż tylko", and the groups are Przedmiar / Wykonana praca / Puste pozycje / Źródło stawki ×2 /
  Udział ×2 / Komentarz / Rabat.
- **Single and combined ticks:**
  - Tick „Z komentarzem": only commented pozycje remain, and the chip reads „Tylko: pozycje z
    komentarzem".
  - Add „Z rabatem": only pozycje with both remain.
  - Tick „Bez komentarza" as well: the comment group stops narrowing.
- **Planned but no work done:** tick „Z przedmiarem" and „Bez wykonanej pracy". Only pozycje with a
  przedmiar and no work done remain.
- **Rate source reveals columns:** tick „Kwota stała" under „Źródło stawki wykonawcy — z narzędziami".
  Only those pozycje remain and the plane's price columns appear.
- **„Przegląd AI":** switch it on. „Z przedmiarem lub AI przedmiarem" is ticked and the sekcje still
  fold.
- **Global rabat:** with a global rabat on, the Rabat group is absent and no rows are hidden by a
  leftover pick.
- **Empty grid:** combine ticks to empty the grid. It reads „Brak pozycji spełniających filtry" and
  names the filters.
- **Szablon:** same checks on a szablon („Co widać: pozycje").

**Implementation Note**: commit when automated verification passes and continue.

---

## Phase 3: Work catalogue „Filtry"

### Overview

Apply the same facet grammar to the catalogue, and add the residual „Udział w cenie" option so no
filter that works today is lost.

### Changes Required

#### 1. Conditions and engine

**File**: `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts`

**Intent**:

- Split the groups per plane: „Źródło stawki" + plane dash suffix, and „Udział w cenie" + plane dash
  suffix.
- Add `catalogue-ceiling-na-{plane}` with the label „nie dotyczy (auto lub bez ceny j.m.)" + plane
  suffix. It matches `!namesRate || !hasPrice`, which makes the „Udział w cenie" group a partition.
- `applyCatalogueConditions`: filters OR within their group and AND across groups. Problems keep-only,
  as today.

**Contract**:

- Existing ids are unchanged; one new id is added per plane.
- Labels keep the plane suffix, because cmdk keys rows by label.

#### 2. Menu, chips, storage

**File**: `catalogue-filters-menu.tsx`, `catalogue-filters-menu-model.ts`,
`catalogue-active-filters-model.ts`, `work-catalogue-data-table.tsx`

**Intent**: Mirror Phase 2:

- `active = engaged`
- the same listing rule (`0 < count < rowCount`, or engaged)
- no bulk row
- trigger counts engaged filters
- intro „Pokaż tylko" / the same hint
- chips „Tylko: prace {label}"
- storage key `work-catalogue-show`

**Contract**: `onToggleAll` is removed from `CatalogueFiltersMenu` props.

#### 3. Specs

**File**: `src/__tests__/lib/kosztorys/work-catalogue/catalogue-conditions.test.ts`,
`src/__tests__/components/work-catalogue/catalogue-filters-menu-model.test.ts`,
`src/__tests__/components/work-catalogue/catalogue-active-filters-model.test.ts`

**Intent**:

- A partition spec per filter group, including the residual option.
- Equivalence: „untick ponad (w)" == tick „w granicy (w)" + „nie dotyczy (w)".
- Facet OR/AND behaviour.
- A problem still keeps-only alongside facets.
- Update the menu-model and chip expectations.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-conditions.test.ts src/__tests__/components/work-catalogue/`

#### Manual Verification

- **Catalogue basics:** open the work catalogue „Filtry". Nothing is ticked, and „Źródło stawki" and
  „Udział w cenie" each appear once per plane.
- **Single tick and the residual option:**
  - Tick „W granicy 65% — z narzędziami": only those prace remain.
  - Add „Nie dotyczy": auto and unpriced prace join them.
- **„Problemy" alongside filters:** pick one problem with a filter ticked. The two combine, and their
  chips read „Tylko: …".

**Implementation Note**: commit when automated verification passes and continue.

---

## Phase 4: Option lists, „Sekcje", users and investment statuses

### Overview

Flip the `FilterMultiSelect` options mode so nothing is ticked when unfiltered. Keep „Sekcje"
unchanged. Make „nothing ticked = all" hold in the two hand-rolled tick-to-see filters.

### Changes Required

#### 1. Primitive

**File**: `src/components/filters/filter-multi-select.tsx`

**Intent**:

- `deriveSelected([])` returns `[]` (nothing ticked). `['__none__']` also returns `[]`, so stale URLs
  render the same.
- `flush` emits exactly the ticked ids, `[]` when none.
- Without `bulkLabels`, the bulk row becomes a single „Wyczyść" (`filters.clear`), shown only while
  something is ticked. With `bulkLabels` (sections), the bulk row keeps today's select/deselect
  behaviour.
- Default trigger badge = ticked count. `isFiltered` = ticked count > 0, or an active toggle.
- Reset clears to `[]`. It is disabled when `resetAction.disabled` and nothing is ticked.
- Locked values still render ticked + disabled.
- Remove `FILTER_NONE` from the primitive's write path. Keep the export only if a reader still needs
  it, and gate that on typecheck.

**Contract**:

- Add the dictionary key `filters.clear` to `pl.ts` „Wyczyść", `uk.ts` „Очистити", `ru.ts` „Очистить".
- `selectAll` / `deselectAll` stay only if still referenced.

#### 2. „Sekcje" adapter

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-sections-menu.tsx`

**Intent**:

- Always pass the explicit expanded-id list (possibly empty).
- In `onValuesChange`, read `[]` as „collapse all" and a list as „keep those open".
- „Rozwiń/Zwiń wszystkie sekcje" and the „Sekcje z rabatem" rows behave as today.

**Contract**: No visible change.

#### 3. Option-list consumers and chips

**File**: `src/hooks/use-client-multi-filter.ts`, `src/components/work-catalogue/catalogue-active-filters-model.ts`
(the `FILTER_NONE` → „żadna" branch), `worker-expense-drafts-table.tsx` (default `['pending']` stays
and now renders as one tick)

**Intent**: Remove the paths that can no longer be reached (`FILTER_NONE` in the client filter and in
the chips), gated on typecheck. Defaults that pre-tick an option stay as they are.

**Contract**: `[]` still means no filter everywhere.

#### 4. Users „Pracownicy" and investment statuses

**File**: `src/hooks/use-user-list-filters.ts`, `src/hooks/use-status-filter.ts` (or its consumer in
`investment-data-table.tsx`)

**Intent**: An empty selection shows every row, rather than none. Defaults („Aktywni"; quote /
planowana / active) stay pre-ticked.

**Contract**: `isListed` returns true for every row when both „Pracownicy" flags are off. In the
status filter, an empty selection means all statuses.

#### 5. Specs and the E2E driver

**File**:

- `src/__tests__/components/filters/filter-multi-select.test.tsx` — add options-mode specs.
- `src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`
- `src/__tests__/components/worker-reports/worker-report-history-table.test.tsx`
- `src/__tests__/components/tables/users.test.tsx`
- `src/__tests__/use-status-filter.test.ts`
- `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.test.tsx` (sections)
- `e2e/equipment-registry.spec.ts:104-110`

**Intent**:

- Options mode:
  - nothing is ticked when unfiltered
  - a tick emits `[id]`
  - ticking all emits every id, not `[]`
  - unticking the last one emits `[]`
  - „Wyczyść" emits `[]`
- Users: both „Pracownicy" ticks off shows all workers.
- Status filter: an empty selection shows all statuses.
- Sections still collapse and expand.
- The test helpers that clicked „Odznacz wszystkie" before ticking now tick directly. The equipment
  spec is edited, **not run**.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/components/filters/ src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx src/__tests__/components/worker-reports/worker-report-history-table.test.tsx src/__tests__/components/tables/users.test.tsx src/__tests__/use-status-filter.test.ts src/__tests__/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.test.tsx src/__tests__/components/work-catalogue/catalogue-active-filters-model.test.ts`

#### Manual Verification

- **Transfers:** open `/transakcje` → Typ. Nothing is ticked and every type is listed. Tick one: the
  list narrows and the URL carries that id. „Wyczyść" restores everything.
- **Equipment:** „Gdzie jest" → tick „Magazyn". Only warehouse items remain.
- **Worker expense drafts:** „Status" opens with only „Oczekujące" ticked (the default). Untick it:
  all statuses show.
- **Kosztorys „Sekcje":**
  - Every section is ticked when expanded.
  - Unticking one collapses it.
  - „Zwiń wszystkie sekcje" collapses all.
  - „Sekcje z rabatem" toggles those sections.
- **Users:** untick both „Aktywni" and „Nieaktywni". All workers are listed.
- **Investments:** untick every status in „Widoczne statusy". All investments are listed.

**Implementation Note**: commit when automated verification passes and continue.

---

## Testing Strategy

### Unit Tests

- Partition specs per filter group (kosztorys, catalogue): the „no filter lost" guard for future
  registry additions.
- Equivalence specs: the old hide-set result equals the new tick-complement result.
- Facet semantics: OR within a group, AND across groups, both halves ticked equals all, inert rabat
  stripped, diagnostics and problems still keep-only.
- `FilterMultiSelect` options mode: display, emit and clear.

### Integration Tests

- None. The change is client-side filtering, and URL parsing on the server is unchanged.

### E2E

- `e2e/equipment-registry.spec.ts` is adapted to the new options-mode flow, not run here (the
  `/10x-e2e` owner runs it).

## Migration Notes

There is no DB change. The localStorage keys for kosztorys, szablon and catalogue picks are renamed,
so old picks (whose meaning is inverted) are dropped and every reader starts unfiltered once. Users
and status flags keep their keys; their semantics only widen in the empty case.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Every spec touched in Phases 1–4 passes (the full suite runs at pre-push)

## References

- EX-665 grammar being reversed: `c6c32570d`
- „Przegląd AI" owner ruling: `context/archive/2026-10-06-kosztorys-ai-knowledge-loop/change.md:133-145`
- Facets: `src/lib/kosztorys/row-conditions/queries.ts:23`,
  `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts:138`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kosztorys engine and registry facets

#### Automated

- [ ] 1.1 Facet, partition and equivalence specs pass
- [ ] 1.2 Existing consumers of the engine still pass

### Phase 2: Kosztorys and szablon „Filtry" UI

#### Automated

- [ ] 2.1 Toolbar, empty-grid and AI-review specs pass

### Phase 3: Work catalogue „Filtry"

#### Automated

- [ ] 3.1 Catalogue conditions and menu specs pass

### Phase 4: Option lists, „Sekcje", users and investment statuses

#### Automated

- [ ] 4.1 Primitive, consumer, users, status and sections specs pass
