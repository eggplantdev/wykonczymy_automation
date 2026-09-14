'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Archive, Copy, Tags, TriangleAlert } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { cn } from '@/lib/utils/cn'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import { catalogueCategoryOptions } from '@/lib/kosztorys/work-catalogue/category-options'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import { findSuspects, type SuspectLevelT } from '@/lib/kosztorys/work-catalogue/suspects'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

const getCategory = (row: WorkCatalogueItemT) => row.category ?? ''

// Counted off the whole cennik, not off what the other filters left: this is the size of the review
// backlog, and a number that shrank when „Kategoria" narrowed would be answering a question nobody
// asked.
const countByLevel = (
  suspects: ReadonlyMap<number, { level: SuspectLevelT }>,
  level: SuspectLevelT,
) => [...suspects.values()].filter((suspect) => suspect.level === level).length

export function WorkCatalogueDataTable({ data }: { data: WorkCatalogueItemT[] }) {
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(data, getSearchableText)
  // Kategoria narrows what the search box already found, so the menu's count is about rows on screen
  // rather than about the whole cennik.
  const {
    filteredData,
    values: categories,
    setValues: setCategories,
  } = useClientMultiFilter(searched, getCategory)

  // TEMPORARY, same lifespan as the row's clear-marker button: the review works through the
  // catalogue items pulled out of the old sheets, and the search box only reaches them by typing the
  // note out.
  const [onlyLegacy, setOnlyLegacy] = useState(false)

  // TEMPORARY (EX-748 review), like the colours themselves: one level at a time, because the two
  // questions are answered separately — „czy to w ogóle praca" and „który bliźniak zostaje".
  const [onlyLevel, setOnlyLevel] = useState<SuspectLevelT>()

  // TEMPORARY (EX-748 review): computed over `data`, so a row keeps its colour whatever is filtered.
  const suspects = useMemo(() => findSuspects(data), [data])

  const legacyRows = filteredData.filter((row) => hasLegacyMarker(row.description))
  const levelRows = filteredData.filter((row) => suspects.get(row.id)?.level === onlyLevel)
  // Narrows LAST, so „Kategoria" keeps counting rows this filter has not touched. And the count is a
  // promise about what the click will show — over `data` it promised 742 rows while delivering 3.
  const rows = onlyLegacy ? legacyRows : onlyLevel ? levelRows : filteredData

  // Redrawing ~950 unvirtualized rows blocks the click for as long as it takes, so the filters stay
  // urgent and the TABLE lags behind them: the toggle flips under the finger and the rows catch up
  // behind the spinner. Deferred here rather than per filter because every control feeds this list.
  const deferredRows = useDeferredValue(rows)
  const busy = rows !== deferredRows

  const categoryOptions = useMemo(() => catalogueCategoryOptions(data), [data])

  // The form's autocomplete offers only kategorie that exist — „Bez kategorii" is a filter answer,
  // not something to type into a new praca.
  const categorySuggestions = useMemo(
    () => categoryOptions.map((option) => option.value).filter((value) => value !== ''),
    [categoryOptions],
  )

  // Numbered off `data`, never off what is on screen, so filtering cannot renumber a praca. Sorted
  // here rather than taken as it arrives: `listCatalogueItems` orders by kategoria FIRST, so the
  // arrival index counts in an order the table never shows.
  const ordinals = useMemo(
    () =>
      new Map(
        [...data]
          .sort((first, second) => compareDescriptions(first.description, second.description))
          .map((row, index) => [row.id, index + 1]),
      ),
    [data],
  )

  const columns = useMemo(
    () => getWorkCatalogueColumns({ categorySuggestions, ordinals, suspects }),
    [categorySuggestions, ordinals, suspects],
  )

  return (
    <DataTable
      data={deferredRows}
      columns={columns}
      initialSorting={INITIAL_SORTING}
      belowToolbar={
        /* Counted off `rows`, not off the deferred list the table renders: behind the spinner the
           count would still be naming the previous search for as long as ~950 rows take to redraw. */
        <span className="text-muted-foreground block text-sm">
          {rows.length} {itemNoun(rows.length)}
          {rows.length !== data.length && ` z ${data.length}`}
        </span>
      }
      toolbar={() => (
        <>
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy..."
            className={SEARCH_FILTER_TOOLBAR_WIDTH}
          />
          <FilterMultiSelect
            label="Kategoria"
            options={categoryOptions}
            values={categories}
            onValuesChange={setCategories}
            icon={Tags}
            searchable
          />
          {/* Stays mounted while it is ON even at zero — the last clear-marker click of the review
              drops the count to 0, and a trigger that unmounted there would leave the table filtered
              to nothing with no control to switch off. */}
          {(legacyRows.length > 0 || onlyLegacy) && (
            <FilterTriggerButton
              active={onlyLegacy}
              icon={Archive}
              onClick={() => setOnlyLegacy((previous) => !previous)}
            >
              {`Stary arkusz (${legacyRows.length})`}
            </FilterTriggerButton>
          )}
          {/* Same lifespan as the colours they filter. „Bez sensu" wears the destructive tone because
              its subject IS the defect; „Duplikaty" stays neutral — a twin is a choice, not a fault. */}
          <FilterTriggerButton
            active={onlyLevel === 'junk'}
            tone="destructive"
            icon={TriangleAlert}
            onClick={() => setOnlyLevel((previous) => (previous === 'junk' ? undefined : 'junk'))}
          >
            {`Bez sensu (${countByLevel(suspects, 'junk')})`}
          </FilterTriggerButton>
          <FilterTriggerButton
            active={onlyLevel === 'duplicate'}
            icon={Copy}
            onClick={() =>
              setOnlyLevel((previous) => (previous === 'duplicate' ? undefined : 'duplicate'))
            }
          >
            {`Duplikaty (${countByLevel(suspects, 'duplicate')})`}
          </FilterTriggerButton>
          <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
          {/* Always mounted: toggling it would resize the flex row and nudge the buttons sideways on
              every keystroke. */}
          <GradientSpinner className={cn(!busy && 'invisible')} />
        </>
      )}
    />
  )
}
