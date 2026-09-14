'use client'

import { useMemo, useState, useTransition } from 'react'
import { Archive, Loader2, Tags } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { cn } from '@/lib/utils/cn'
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
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

const getCategory = (row: WorkCatalogueItemT) => row.category ?? ''

export function WorkCatalogueDataTable({ data }: { data: WorkCatalogueItemT[] }) {
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
    isFiltering,
  } = useSearchFilter(data, getSearchableText)
  // Kategoria narrows what the szukajka already found, so the menu's count is about rows on screen
  // rather than about the whole cennik.
  const {
    filteredData,
    values: categories,
    setValues: setCategories,
  } = useClientMultiFilter(searched, getCategory)

  // TEMPORARY, same lifespan as the row's ptaszek: the review works through the prace pulled out of
  // the old sheets, and the szukajka only reaches them by typing the note out. Narrows LAST, so the
  // „Kategoria" count keeps meaning what it meant before this existed.
  const [onlyLegacy, setOnlyLegacy] = useState(false)
  // Both menus redraw ~950 unvirtualized rows, which blocks the click for as long as it takes. In a
  // transition the toolbar keeps answering and the table catches up behind the spinner — the same
  // bargain the szukajka already strikes with `useDeferredValue`.
  const [isPending, startFilterTransition] = useTransition()
  const rows = useMemo(
    () =>
      onlyLegacy ? filteredData.filter((row) => hasLegacyMarker(row.description)) : filteredData,
    [filteredData, onlyLegacy],
  )

  // Counted over what the szukajka and „Kategoria" already left standing, not over the whole cennik:
  // the number is a promise about what the click will show, and over `data` it promised 742 rows
  // while delivering 3.
  const legacyCount = useMemo(
    () => filteredData.filter((row) => hasLegacyMarker(row.description)).length,
    [filteredData],
  )

  const categoryOptions = useMemo(() => catalogueCategoryOptions(data), [data])

  // The form's autocomplete offers only kategorie that exist — „Bez kategorii" is a filter answer,
  // not something to type into a new praca.
  const categorySuggestions = useMemo(
    () => categoryOptions.map((option) => option.value).filter((value) => value !== ''),
    [categoryOptions],
  )

  const columns = useMemo(
    () => getWorkCatalogueColumns({ categorySuggestions }),
    [categorySuggestions],
  )

  const busy = isFiltering || isPending

  return (
    <div className={cn('transition-opacity', busy && 'opacity-60')}>
      <DataTable
        data={rows}
        columns={columns}
        initialSorting={INITIAL_SORTING}
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
              onValuesChange={(next) => startFilterTransition(() => setCategories(next))}
              icon={Tags}
              searchable
            />
            {/* Stays mounted while it is ON even at zero — the last ptaszek of the review drops the
                count to 0, and a trigger that unmounted there would leave the table filtered to
                nothing with no control to switch off. */}
            {(legacyCount > 0 || onlyLegacy) && (
              <FilterTriggerButton
                active={onlyLegacy}
                icon={Archive}
                onClick={() => startFilterTransition(() => setOnlyLegacy((previous) => !previous))}
              >
                {`Stary arkusz (${legacyCount})`}
              </FilterTriggerButton>
            )}
            <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
            {busy && <Loader2 className="text-muted-foreground animate-spin" />}
          </>
        )}
      />
    </div>
  )
}
