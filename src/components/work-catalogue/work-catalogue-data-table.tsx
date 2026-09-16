'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Archive, Tags } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { DataTableToolbar } from '@/components/ui/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { cn } from '@/lib/utils/cn'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import { catalogueCategoryOptions } from '@/lib/kosztorys/work-catalogue/category-options'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

const getCategory = (row: WorkCatalogueItemT) => row.category ?? ''

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

  const legacyRows = filteredData.filter((row) => hasLegacyMarker(row.description))
  // Narrows LAST, so „Kategoria" keeps counting rows this filter has not touched. And the count is a
  // promise about what the click will show — over `data` it promised 742 rows while delivering 3.
  const rows = onlyLegacy ? legacyRows : filteredData

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
    () => getWorkCatalogueColumns({ categorySuggestions, ordinals }),
    [categorySuggestions, ordinals],
  )

  return (
    <DataTable
      data={deferredRows}
      columns={columns}
      storageKey="work-catalogue"
      initialSorting={INITIAL_SORTING}
      aboveToolbar={
        /* Counted off `rows`, not off the deferred list the table renders: behind the spinner the
           count would still be naming the previous search for as long as ~950 rows take to redraw. */
        <span className="text-muted-foreground block text-sm">
          {rows.length} {itemNoun(rows.length)}
          {rows.length !== data.length && ` z ${data.length}`}
        </span>
      }
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: 'Szukaj pracy...',
          }}
          filters={
            <>
              <FilterMultiSelect
                label="Kategoria"
                options={categoryOptions}
                values={categories}
                onValuesChange={setCategories}
                icon={Tags}
                searchable
              />
              {/* Stays mounted while it is ON even at zero — the last clear-marker click of the
                  review drops the count to 0, and a trigger that unmounted there would leave the
                  table filtered to nothing with no control to switch off. */}
              {(legacyRows.length > 0 || onlyLegacy) && (
                <FilterTriggerButton
                  active={onlyLegacy}
                  icon={Archive}
                  onClick={() => setOnlyLegacy((previous) => !previous)}
                >
                  {`Stary arkusz (${legacyRows.length})`}
                </FilterTriggerButton>
              )}
              {/* Always mounted: toggling it would resize the flex row and nudge the buttons
                  sideways on every keystroke. Gone below `sm` instead — there the toolbar is a grid,
                  so an invisible spinner holds a whole cell and opens a phantom row. */}
              <GradientSpinner className={cn('max-sm:hidden', !busy && 'invisible')} />
            </>
          }
          actions={<AddCatalogueItemDialog categorySuggestions={categorySuggestions} />}
        />
      )}
    />
  )
}
