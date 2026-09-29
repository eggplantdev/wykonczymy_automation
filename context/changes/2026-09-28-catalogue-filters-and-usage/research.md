---
date: 2026-09-29T11:38:03+02:00
researcher: Claude (Opus 5.5)
git_commit: 808ba761
branch: staging
repository: wykonczymy
topic: 'Katalog prac — Filtry/Problemy menus (EX-863) + on-click usage report (EX-873)'
tags: [research, codebase, work-catalogue, filters, problems, kosztorys, usage-report]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: Katalog prac — Filtry/Problemy menus + usage report

**Date**: 2026-09-29T11:38:03+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 808ba761
**Branch**: staging
**Repository**: wykonczymy

## Research Question

How do we give `/katalog-prac` the kosztorys editor's „Filtry" / „Problemy" menus (EX-863), and add
an on-click „Policz użycia" report (EX-873) — a „Kosztorysy" count column, a „Użycie" filter group, a
second list of used-but-uncatalogued works with hints, and a „występuje z inną j.m." marker — within
the decisions recorded in `change.md` („Decyzje 2026-09-29")?

## Summary

- **The UI primitives port as-is**: `FilterMultiSelect` (toggles mode), `DropdownCheckGroups`,
  `FilterTriggerButton` (`tone="destructive"`), `FilterChip`. What does NOT port is the condition
  registry — it is typed on the rozpiska row plus the stage context. The catalogue gets its own small
  registry. The two menu models (`filtersMenuModel` / `problemsMenuModel`) share one generic core, and
  that core is the piece to extract. The editor keeps its current wrapper signatures, so its specs
  stay green.
- **Every figure a filter needs is already on `WorkCatalogueItemT`**, except usage, and all the
  helpers exist: the rate source (`catalogueSourceOf`), the ceiling (`isOverCeiling`, per plane), and
  the price. No schema change and no migration.
- **Usage is one cheap SQL read plus Node-side matching.** The SQL reads the used pozycje (2 ms,
  ~1.2k rows). The matching must run in Node, because `foldDescription` applies typo fixes that exist
  only in TS. The stored `work_catalogue_items.match_key` has 0 drift, so it is the right join
  target. Key matching takes 9 ms; hints for the uncatalogued list take ~415 ms, which is acceptable
  on a click.
- **The read is a `'use server'` query in its own file** (`src/lib/queries/catalogue-usage.ts`)
  wrapping `protectedAction`. The SQL goes in `src/lib/db/`, and the pure matching/grouping in
  `src/lib/kosztorys/work-catalogue/`.
- **Five design points are open for the plan** (see Open Questions):
  - the ceiling is per plane, 65 % / 55,25 %, not a flat 65 %;
  - the „w granicy" negation swallows „auto" rows;
  - the Kategoria counts are taken after search;
  - there is no slot below the toolbar for the chip bar;
  - no test-plan risk covers the catalogue page.

## Detailed Findings

### 1. Current catalogue page and table

- Route `src/app/(frontend)/katalog-prac/page.tsx:9-20`: `requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)`,
  then `getWorkCatalogue()` (`src/lib/queries/work-catalogue.ts:20-27`; `unstable_cache` with key
  `['work-catalogue']` and tag `CACHE_TAGS.workCatalogue`), then `listCatalogueItems`
  (`src/lib/db/work-catalogue.ts:58-65`).
- `src/components/work-catalogue/work-catalogue-data-table.tsx` (115 lines) chains
  `useSearchFilter`, then `useClientMultiFilter(searched, getCategory)`, then `useDeferredValue`. It
  shows a busy spinner and takes ordinals from the unfiltered `data`.
  - `DataTable` receives `aboveToolbar` (the count) and a `toolbar` render prop, which returns a
    `DataTableToolbar` with these slots:
    - `search`;
    - `filters`: the Kategoria `FilterMultiSelect`, with `GRID_FILTER_TRIGGER_CLASS` and a
      `GradientSpinner`;
    - `actions`: `AddCatalogueItemDialog`.
  - **The Kategoria menu counts the rows left after search**, not the whole dataset. That breaks the
    editor's rule that counts come from the whole dataset (open question 3).
- Row type `src/lib/kosztorys/work-catalogue/types.ts`:
  `{ id, description, category|null, unit, clientPrice, wToolsRate|null, ownToolsRate|null,
wToolsRateCoeff|null, ownToolsRateCoeff|null, matchKey }`.
- Kategoria options: `src/lib/kosztorys/work-catalogue/category-options.ts`. An empty value is
  labelled „Bez kategorii", and that option stays.
- The columns (`src/components/tables/work-catalogue.tsx`) already compute the share per plane and
  mark the overrun with `isOverCeiling(rateAmount(row, plane), row, plane)` (`:140-152`). The filter
  must call the same predicate, so the red cell and the filter can never disagree.

### 2. Editor Filtry/Problemy machinery (the thing to port)

- **Semantics** (domain notes 1144-1258):
  - Filters use tick = visible. They come in complementary pairs and combine with AND.
  - Problems are exclusive (`toggleConditionExclusive`), keep only the matching rows, and combine
    with OR.
  - Counts are always taken over the whole dataset.
  - A count-0 row is hidden unless it is engaged; an engaged row stays visible at (0).
  - The Problemy trigger disappears when its list is empty.
  - The chip bar wraps and shows „Wyczyść wszystko" only when there are 2 or more chips.
  - Condition ids are literal strings with no id factory, because they are persisted in
    localStorage.
- Models: `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts` and
  `problems-menu-model.ts`. Both run the same core:
  ```ts
  .map((c) => ({ c, count: counts.get(c.id) ?? 0 }))
  .filter(({ c, count }) => count > 0 || engagedIds.has(c.id))
  .map(({ c, count }) => ({ id: c.id, groupLabel, label: `${…} (${count})`, active: /* !engaged | engaged */ }))
  ```
  They differ only in polarity: filters report `active = !engaged` (ticked = shown), problems report
  `active = engaged`.
- Menus: `kosztorys-filters-menu.tsx` (trigger count = `toggles.filter(t => !t.active).length`) and
  `kosztorys-problems-menu.tsx`, together with `use-kosztorys-filter-menu.ts`,
  `use-filter-reset-action.ts`, `toolbar/active-filters-model.ts` and
  `kosztorys-active-filters-bar.tsx`.
- Registry: `src/lib/kosztorys/row-conditions/{types,registry,queries}.ts`. The registry is 558 lines,
  typed on `KosztorysV2RowT` plus `RowConditionCtxT`, and grouped by `filter-groups.ts` /
  `problem-groups.ts`. It cannot be reused for the catalogue row, and per lesson ~2307 (a long
  declarative registry is cohesive) it should not be split for the sake of it.
- State: `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts` stores the engaged ids in
  localStorage under the key `kosztorys-filters:<investmentId>`, via `createJsonMapStore`
  (`src/hooks/create-json-map-store.ts`). Counts are computed in `use-kosztorys-editor.ts:473-504`.
- **Proposed extraction**, with names left to the plan:
  - `ConditionT<Row> = { id, label, groupLabel, matches(row) }`
  - `countConditions<Row>(rows, conditions): Map<string, number>`
  - `applyConditions<Row>(rows, engaged, hiders, keepers?)`
  - `conditionToggles({ conditions, engagedIds, counts, polarity: 'visible' | 'pressed', rowLabel })`
  - `visibilityTogglesBulk(toggles, setMany)`
  - `useEngagedIds(storageKey)`, with `useEngagedConditions(investmentId)` kept as a thin wrapper
    around it
  - `ActiveFiltersBar<R>({ chips, onRemove, onClearAll })`

  The editor wrappers keep their signatures, so the existing specs are the safety net for the
  extraction.

- **UI primitives, reusable unchanged:**
  - `src/components/filters/filter-multi-select.tsx`: toggles mode, a header wherever `groupLabel`
    changes, plus `resetAction`, `togglesBulk` and `triggerCount`. The cmdk value is the label, so
    labels must be unique across groups, e.g. „auto" must not appear twice.
  - `src/components/ui/dropdown-check-groups.tsx`
  - `src/components/filters/filter-trigger-button.tsx`
  - `src/components/filters/filter-chip.tsx`

  Inside `DataTableToolbar` the `filters` slot is a `ControlGrid`, so each trigger takes
  `GRID_FILTER_TRIGGER_CLASS`.

### 3. Catalogue conditions — data available per row

| Condition (change.md)                           | Menu                         | Predicate source                                    | Local count (561 rows)  |
| ----------------------------------------------- | ---------------------------- | --------------------------------------------------- | ----------------------- |
| bez ceny j.m.                                   | Problemy                     | `clientPrice` is 0 or null                          | 20                      |
| stawka 0 z narzędziami / bez                    | Problemy                     | the resolved kwota for the plane is 0               | 18 / 21                 |
| źródło stawki kwota / mnożnik / auto, per widok | Filtry                       | `catalogueSourceOf` (`catalogue-rate.ts:26`)        | auto 124 / 124          |
| ponad limit / w granicy, per widok              | Filtry                       | `isOverCeiling` (`subcontractor-price-guard.ts:61`) | 14 over (z narzędziami) |
| j.m.                                            | own menu next to Kategoria   | `unit`                                              | 10 distinct             |
| Użycie: nieużywane / używane                    | Filtry, only after the click | usage map                                           | 384 / 177               |

- „Ujemna stawka" is dropped. It is unreachable: `work-catalogue-item-schema.ts:19,30,101,106` rejects
  a negative kwota and a negative mnożnik, and there are 0 such rows locally.
- **The ceiling is per plane**: `MAX_CLIENT_SHARE = { w_tools: DEFAULT_COEFFS.wTools, own_tools:
DEFAULT_COEFFS.ownTools }` (`subcontractor-price-guard.ts:18`), which is 65 % z narzędziami and
  55,25 % bez narzędzi. The labels must come from `clientShareCeilingLabel(plane)`, never from a
  hand-written „65 %". The change.md wording „ponad 65 %" is therefore wrong for the bez-narzędzi
  plane.
- **The w-granicy trap** (`subcontractor-price-guard.ts:104-116`): „auto" has no share of its own. A
  plain `!isOverCeiling` therefore counts every auto row as „w granicy". EX-820's manual check
  (`manual-checks.md` l.775) already has an open finding on exactly this.

### 4. Usage read — SQL, scope, measurements

- **Definition of „used"**, owner ruling 2026-09-28: `planned_qty > 0` OR there EXISTS a
  `stage_progress.qty_done > 0`.
- **Scope**: `i.status <> 'szablon' AND i.trashed_at IS NULL`. This is the existing pattern at
  `src/lib/queries/reference-data.ts:73`, and the constant is `TEMPLATE_INVESTMENT_STATUS` in
  `src/lib/constants/investment-lock.ts:28`. Wyceny (`quote`) count.
- Query (2.0 ms locally; a grouped variant with `array_agg(DISTINCT investment_id)` takes 4.3 ms and
  returns 436 rows):
  ```sql
  SELECT ki.investment_id, ki.description, ki.unit
  FROM kosztorys_items ki
  JOIN investments i ON i.id = ki.investment_id
  WHERE i.status <> 'szablon' AND i.trashed_at IS NULL
    AND (ki.planned_qty > 0
         OR EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = ki.id AND sp.qty_done > 0));
  ```
- There is precedent for cross-investment SQL:
  - `KOSZTORYS_USED` in `src/lib/db/investment-trash.ts:10-20`, which uses `<> 0` rather than `> 0`,
    so it is a different predicate and must not be reused blindly;
  - `selectKosztorysClientTotals` in `src/lib/db/kosztorys-client-totals.ts:35-91`.
- **Matching**: `catalogueKey(description, unit)` = `${foldDescription(d)}|${foldUnit(u) || '~'}`.
  `foldDescription` applies `TYPO_FIXES` and `CATALOGUE_NAME_FIXES`, which exist only in TS, so the
  matching runs in Node. The pozycja side has no stored key, while
  `work_catalogue_items.match_key` is stored (UNIQUE) with 0 drift.
- **Count unit** = distinct investments per catalogue key, not pozycje (lesson ~1630: a counter's
  unit is part of its meaning). The column is labelled „Kosztorysy".
- **„Inna j.m." marker**: the catalogue row's `foldDescription` matches a used pozycja's, but the
  unit differs. There are 10 such rows locally. The existing phrasing is `hintLead` in
  `catalogue-missing-list.tsx:137-141` („ta sama nazwa, inna j.m.:").
- **Used-but-uncatalogued list**: groups by key, sorted by kosztorys count, with hints from the
  existing Dice-bigram mechanism (`attachCatalogueHints`, `build-catalogue-comparison.ts:235-242`;
  threshold 0.55, max 3). `closestEntries` (`:49-66`) is not exported yet.
- **Measurements** (local prod copy, 2026-09-29):

  | Figure                             | Value                          |
  | ---------------------------------- | ------------------------------ |
  | kosztorys pozycje in total         | 8975                           |
  | pozycje in scope                   | 8355, in 26 inwestycje         |
  | used pozycje                       | 1236, in 24 inwestycje         |
  | matched exactly to a catalogue row | 853 (69 %)                     |
  | catalogue rows with at least 1 use | 177 / 561                      |
  | uncatalogued groups                | 229 (167 with at least 1 hint) |
  | catalogue rows with „inna j.m."    | 10                             |
  | Node matching / hints              | 9 ms / 415 ms                  |

  **There are no quote or trashed investments locally**, so the trash exclusion is untested on real
  data. The plan needs a fixture for it.

### 5. On-demand read placement

- Pattern: `src/lib/queries/catalogue-save-preview.ts:10-19`, `investment-asset-ids.ts:15-22` and
  `preset-pickers.ts:13-18`. Each is a `'use server'` module wrapping `protectedAction`
  (`src/lib/actions/run-action.ts:41-73`) and returning `ActionResultT`.
- It needs its **own file**. Putting `'use server'` into `work-catalogue.ts` would export the cached
  `getWorkCatalogue` as a public RPC.
- Layering, per AGENTS.md: statement plus mapper in `src/lib/db/`; React-free key matching, grouping
  and hints in `src/lib/kosztorys/work-catalogue/` (testable in node); auth in `src/lib/queries/`.
- **No caching needed.** The read is on a click, costs 2 ms of SQL and ~0.4 s of Node, and its
  freshness is its whole point.

### 6. Chip bar and toolbar placement

- `src/components/tables/data-table/data-table.tsx` has a `toolbar` render prop and `aboveToolbar`,
  but **no slot below the toolbar**. The options are a fragment returned from the `toolbar` render
  prop, or a new `belowToolbar` prop. Transfers has no chip bar, so this is the first table-level one.
- The „Policz użycia" button would sit in `actions` next to „Dodaj pracę". Lesson ~1149 warns that a
  container holding two features' buttons ends up with a visibility gate nobody chose. Both buttons
  here belong to the same role gate (the page's `ADMIN_OR_OWNER_MANAGER_ROLES`), so the risk is low,
  but the plan should state it.

### 7. Second list component

- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx` takes only props,
  and its `readOnly` mode works outside the editor. It still fits the new list poorly:
  - rows are keyed by `itemId`;
  - it prints a `{section} · ` prefix;
  - it has no slot for a kosztorys count;
  - „accept hint" works per pozycja.
- A new small list is the better fit. It should extract and share `CandidateRow` / `hintLead`
  (`:137-190`) rather than duplicate them.

## Code References

- `src/app/(frontend)/katalog-prac/page.tsx:9-20` - route, auth gate, data load
- `src/lib/queries/work-catalogue.ts:20-27` - cached catalogue read
- `src/lib/db/work-catalogue.ts:58-65` - `listCatalogueItems`
- `src/components/work-catalogue/work-catalogue-data-table.tsx` - table, search → category filter
- `src/components/tables/work-catalogue.tsx:140-152` - share columns + `isOverCeiling` highlight
- `src/lib/kosztorys/work-catalogue/types.ts` - `WorkCatalogueItemT`
- `src/lib/kosztorys/work-catalogue/category-options.ts` - Kategoria options, „Bez kategorii"
- `catalogue-rate.ts:26` - `catalogueSourceOf` (kwota / mnożnik / auto)
- `src/lib/kosztorys/subcontractor-price-guard.ts:18,30,61,104-116` - per-plane ceiling, label, predicate, auto trap
- `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:19,30,101,106` - negative rates rejected
- `src/components/kosztorys/editor/toolbar/menus/{filters,problems}-menu-model.ts` - menu models to generalise
- `src/components/kosztorys/editor/toolbar/active-filters-model.ts`, `kosztorys-active-filters-bar.tsx` - chip bar
- `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts` - localStorage engaged-set
- `src/hooks/create-json-map-store.ts` - store factory
- `src/lib/kosztorys/row-conditions/{types,registry,queries}.ts` - editor registry (not reused)
- `src/components/filters/{filter-multi-select,filter-trigger-button,filter-chip}.tsx`, `src/components/ui/dropdown-check-groups.tsx` - primitives
- `src/components/tables/data-table/data-table.tsx` - no below-toolbar slot
- `src/lib/queries/catalogue-save-preview.ts:10-19` - on-demand `'use server'` read pattern
- `src/lib/actions/run-action.ts:41-73` - `protectedAction`
- `src/lib/queries/reference-data.ts:73`, `src/lib/constants/investment-lock.ts:28` - szablon + trash exclusion
- `src/lib/db/investment-trash.ts:10-20` - `KOSZTORYS_USED` (different predicate: `<> 0`)
- `src/lib/db/kosztorys-client-totals.ts:35-91` - cross-investment SQL precedent
- `build-catalogue-comparison.ts:49-66,235-242` - `closestEntries` (unexported), `attachCatalogueHints`
- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:137-190` - `hintLead`, `CandidateRow`

## Architecture Insights

- **Only the generic core is shared.** Primitives and the count/visibility/toggle core are common
  code. Each surface keeps its own registry, typed on its own row. The editor's registry stays whole
  (lesson ~2307).
- **One threshold, one home.** Every ceiling decision goes through `isOverCeiling` and
  `clientShareCeilingLabel`, so the table colour, the filter and the label cannot drift apart.
- **The stored key means a backfill obligation** (lesson ~1774). Joining on
  `work_catalogue_items.match_key` is safe only while that column is kept in sync. It has 0 drift
  today, and a change to `TYPO_FIXES` / `CATALOGUE_NAME_FIXES` requires a re-key. This is also why
  „wyłączników" is an owner decision and not a code edit.
- **A report computed on a click is not cached data.** The usage map is client state that lives only
  for the page session. It does not enter `unstable_cache` and has no tag, so the „Użycie" group
  exists only after the click, which is exactly the behaviour change.md asks for.

## Historical Context (from prior changes)

- `context/archive/2026-08-17-filtry-problemy/review-gate.md` - the editor's Filtry/Problemy shipped
  here. The plan itself was removed and can be recovered from git before `11f14ff2`.
- `context/reference/kosztorys-editor-domain-notes.md`:
  - Filtry/Problemy semantics: 1144-1258
  - ceiling: 836-862
  - three rate sources: 1006-1060
  - picker rulings: 882-907
  - szablon: 1564+
- `context/foundation/manual-checks.md`:
  - katalog problems: l.622
  - compare-bulk-update: l.639
  - EX-820 ceiling, with the open w-granicy finding: l.775
  - EX-856: l.812
  - EX-865 three sources: l.872
  - EX-860: l.1299
- `context/foundation/lessons.md`: ~1149 (a shared button container), ~1630 (a counter's unit),
  ~1774 (a stored key needs a backfill), ~2233 (virtualization is a layout change), ~2307 (a
  registry is cohesive), ~2328 (recount before filing).
- Roadmap has no slice for this. It is tracked in Linear (EX-863, EX-873, both In Progress).

## Related Research

- None under `context/changes/**/research.md` for the catalogue page.

## Open Questions

1. **Ceiling labels per plane.** The filter reads „ponad {clientShareCeilingLabel(plane)}", i.e.
   65 % z narzędziami and 55,25 % bez narzędzi. This corrects the „ponad 65 %" in change.md.
2. **What „w granicy" does with auto rows.** Either exclude them („w granicy" = kwota or mnożnik
   within the ceiling) or count them. Recommendation: exclude them. Then „ponad" + „w granicy" +
   „auto" add up to all rows, and the EX-820 open finding is not repeated here.
3. **Kategoria / j.m. count basis.** Today the counts are taken after search. Recommendation: switch
   to the whole dataset, like the editor, so a count never moves when the search moves.
4. **Chip bar placement.** A fragment from the `toolbar` render prop, or a new `belowToolbar` prop on
   `DataTable`. Recommendation: the prop, because it is explicit and costs one line.
5. **Persistence.** Should the catalogue's engaged filters survive a reload (`useEngagedIds('work-catalogue-filters')`)?
   The „Użycie" group must not be persisted, or not restored before the click: its ids would point at
   a group that does not exist yet.
6. **Test-plan gap.** `context/foundation/test-plan.md` has no risk for the catalogue page. Risk #10
   (the katalog counter lies or freezes), #11 (three sources) and #1 (surfaces disagree) are nearby.
   Extend it with `/10x-test-plan` before writing tests. The obvious risks are that the usage count
   disagrees with the kosztorys, and that the filter disagrees with the red cell.
7. **Trash exclusion is unverified** on local data, where there are 0 trashed and 0 quote
   investments. It needs a DB-backed spec with its own fixture.
