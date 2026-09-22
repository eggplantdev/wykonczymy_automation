'use client'

import { useDeferredValue, useMemo } from 'react'
import { Tags } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { cn } from '@/lib/utils/cn'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import { catalogueCategoryOptions } from '@/lib/kosztorys/work-catalogue/category-options'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
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

  // Redrawing ~950 unvirtualized rows blocks the click, so the filters stay urgent and the TABLE lags
  // behind them. Deferred here rather than per filter because every control feeds this list.
  const deferredRows = useDeferredValue(filteredData)
  const busy = filteredData !== deferredRows

  const categoryOptions = useMemo(() => catalogueCategoryOptions(data), [data])

  // The form's autocomplete offers only kategorie that exist — „Bez kategorii" is a filter answer,
  // not something to type into a new praca.
  const categorySuggestions = useMemo(
    () => categoryOptions.map((option) => option.value).filter((value) => value !== ''),
    [categoryOptions],
  )

  // Numbered off `data`, never off what is on screen, so filtering cannot renumber a praca. Sorted
  // here because `listCatalogueItems` orders by kategoria first — an order the table never shows.
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
        /* Counted off `filteredData`, not off the deferred list the table renders: behind the
           spinner the count would still be naming the previous search for as long as ~950 rows
           take to redraw. */
        <span className="text-muted-foreground block text-sm">
          {filteredData.length} {itemNoun(filteredData.length)}
          {filteredData.length !== data.length && ` z ${data.length}`}
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
                triggerClassName={GRID_FILTER_TRIGGER_CLASS}
              />
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
