'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Ruler, Tags } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { cn } from '@/lib/utils/cn'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { ActiveFiltersBar } from '@/components/filters/active-filters-bar'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import {
  catalogueActiveFiltersModel,
  type CatalogueActiveFilterChipT,
} from '@/components/work-catalogue/catalogue-active-filters-model'
import { CatalogueFiltersMenu } from '@/components/work-catalogue/catalogue-filters-menu'
import { catalogueFiltersMenuModel } from '@/components/work-catalogue/catalogue-filters-menu-model'
import { CountUsageButton } from '@/components/work-catalogue/count-usage-button'
import { UncataloguedUsageList } from '@/components/work-catalogue/uncatalogued-usage-list'
import { CatalogueProblemsMenu } from '@/components/work-catalogue/catalogue-problems-menu'
import { catalogueProblemsMenuModel } from '@/components/work-catalogue/catalogue-problems-menu-model'
import { useEngagedIds } from '@/hooks/use-engaged-ids'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import {
  catalogueCategoryOptions,
  catalogueCategorySuggestions,
  catalogueUnitOptions,
} from '@/lib/kosztorys/work-catalogue/category-options'
import {
  CATALOGUE_CONDITIONS,
  CATALOGUE_PROBLEM_IDS,
  applyCatalogueConditions,
  catalogueDuplicateCondition,
  catalogueUsageConditions,
  countCatalogueConditions,
} from '@/lib/kosztorys/work-catalogue/catalogue-conditions'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import { findNearDuplicates } from '@/lib/kosztorys/work-catalogue/catalogue-near-duplicates'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'
import type { CatalogueUsageT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

const getCategory = (row: WorkCatalogueItemT) => row.category ?? ''

const getUnit = (row: WorkCatalogueItemT) => row.unit

export function WorkCatalogueDataTable({ data }: { data: WorkCatalogueItemT[] }) {
  const {
    engagedIds,
    toggle: toggleCondition,
    toggleExclusive,
    setMany,
    clear: clearConditions,
  } = useEngagedIds('work-catalogue-filters')

  // ~0.1 s over 561 wpisy: once per `data`, never per keystroke.
  const nearDuplicates = useMemo(() => findNearDuplicates(data), [data])

  const [usage, setUsage] = useState<CatalogueUsageT | null>(null)
  // Beside the persisted set, never in it — see `catalogueUsageConditions`.
  const [engagedUsageIds, setEngagedUsageIds] = useState<ReadonlySet<string>>(new Set())
  const usageConditions = catalogueUsageConditions(usage)
  const isUsageId = (id: string) => usageConditions.some((condition) => condition.id === id)
  const conditions = [
    ...CATALOGUE_CONDITIONS,
    catalogueDuplicateCondition(nearDuplicates),
    ...usageConditions,
  ]
  const allEngagedIds = new Set([...engagedIds, ...engagedUsageIds])

  function setUsageEngaged(ids: readonly string[], engaged: boolean) {
    setEngagedUsageIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (engaged) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  function toggleFilter(id: string) {
    if (isUsageId(id)) setUsageEngaged([id], !engagedUsageIds.has(id))
    else toggleCondition(id)
  }

  function setFiltersEngaged(ids: readonly string[], engaged: boolean) {
    setUsageEngaged(ids.filter(isUsageId), engaged)
    setMany(
      ids.filter((id) => !isUsageId(id)),
      engaged,
    )
  }

  // Every control ANDs, so the order only decides what gets recomputed: search runs first because it
  // folds its haystacks once per input array, and a condition toggle would otherwise refold them all.
  // The condition counts read `data`, never this chain, so no count moves when another control does.
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(data, getSearchableText)
  const conditioned = applyCatalogueConditions(searched, conditions, allEngagedIds)
  const {
    filteredData: categorised,
    values: categories,
    setValues: setCategories,
  } = useClientMultiFilter(conditioned, getCategory)
  const {
    filteredData,
    values: units,
    setValues: setUnits,
  } = useClientMultiFilter(categorised, getUnit)

  const counts = countCatalogueConditions(data, conditions)
  const filterToggles = catalogueFiltersMenuModel({
    conditions,
    engagedIds: allEngagedIds,
    counts,
  })
  const problemToggles = catalogueProblemsMenuModel({ conditions, engagedIds, counts })

  // Redrawing ~950 unvirtualized rows blocks the click, so the filters stay urgent and the TABLE lags
  // behind them. Deferred here rather than per filter because every control feeds this list.
  const deferredRows = useDeferredValue(filteredData)
  const busy = filteredData !== deferredRows

  const categoryOptions = useMemo(() => catalogueCategoryOptions(data), [data])

  const categorySuggestions = useMemo(() => catalogueCategorySuggestions(data), [data])

  const unitOptions = useMemo(() => catalogueUnitOptions(data), [data])

  const chips = catalogueActiveFiltersModel({
    conditions,
    engagedIds: allEngagedIds,
    counts,
    search: searchTerm,
    categories: { values: categories, options: categoryOptions },
    units: { values: units, options: unitOptions },
  })

  function resetFilters() {
    clearConditions()
    setEngagedUsageIds(new Set())
    setSearchTerm('')
    setCategories([])
    setUnits([])
  }

  function removeChip(chip: CatalogueActiveFilterChipT) {
    switch (chip.removal) {
      case 'condition':
        return toggleFilter(chip.id)
      case 'problem':
        return toggleExclusive(chip.id, CATALOGUE_PROBLEM_IDS)
      case 'search':
        return setSearchTerm('')
      case 'category':
        return setCategories([])
      case 'unit':
        return setUnits([])
    }
  }

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
    () => getWorkCatalogueColumns({ categorySuggestions, ordinals, usage, nearDuplicates }),
    [categorySuggestions, ordinals, usage, nearDuplicates],
  )

  return (
    <>
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
        belowToolbar={
          <ActiveFiltersBar chips={chips} onRemove={removeChip} onClearAll={resetFilters} />
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
                <FilterMultiSelect
                  label="j.m."
                  options={unitOptions}
                  values={units}
                  onValuesChange={setUnits}
                  icon={Ruler}
                  searchable
                  triggerClassName={GRID_FILTER_TRIGGER_CLASS}
                />
                <CatalogueFiltersMenu
                  toggles={filterToggles}
                  onToggle={toggleFilter}
                  // Ticked = visible, so „all ticked" means none engaged.
                  onToggleAll={(ids, visible) => setFiltersEngaged(ids, !visible)}
                  resetAction={{
                    label: 'Zresetuj filtry',
                    onReset: resetFilters,
                    disabled: chips.length === 0,
                  }}
                />
                <CatalogueProblemsMenu
                  toggles={problemToggles}
                  onSelect={(id) => toggleExclusive(id, CATALOGUE_PROBLEM_IDS)}
                />
                {/* Always mounted: toggling it would resize the flex row and nudge the buttons
                  sideways on every keystroke. Gone below `sm` instead — there the toolbar is a grid,
                  so an invisible spinner holds a whole cell and opens a phantom row. */}
                <GradientSpinner className={cn('max-sm:hidden', !busy && 'invisible')} />
              </>
            }
            actions={
              <>
                <CountUsageButton onCounted={setUsage} />
                <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
              </>
            }
          />
        )}
      />
      {usage && <UncataloguedUsageList groups={usage.uncatalogued} />}
    </>
  )
}
