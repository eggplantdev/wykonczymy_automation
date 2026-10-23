'use client'

import { useMemo, useState } from 'react'
import { Boxes, Store, Tags } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { MATERIALS_COLUMNS } from '@/components/tables/materials'
import { FilterMultiSelect, type FilterOptionT } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { Description } from '@/components/ui/description'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import type { MaterialRowT } from '@/lib/materials/types'

const INITIAL_SORTING = [{ id: 'gross', desc: true }]
const DEFAULT_KINDS = ['materiał']

const getSearchableText = (row: MaterialRowT) => `${row.product} ${row.type}`
const getType = (row: MaterialRowT) => row.type
const getKind = (row: MaterialRowT) => row.kind

const countedOptions = (values: string[]): FilterOptionT[] =>
  [...Map.groupBy(values, (value) => value)]
    .map(([value, group]) => ({ value, label: value, count: group.length }))
    .sort((first, second) => second.count - first.count)

export function MaterialsDataTable({ data }: { data: MaterialRowT[] }) {
  const [shops, setShops] = useState<string[]>([])
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(data, getSearchableText)
  const {
    filteredData: kinded,
    values: kinds,
    setValues: setKinds,
  } = useClientMultiFilter(searched, getKind, DEFAULT_KINDS)
  const {
    filteredData: typed,
    values: types,
    setValues: setTypes,
  } = useClientMultiFilter(kinded, getType)
  const filteredData = shops.length
    ? typed.filter((row) => row.shopNames.some((shop) => shops.includes(shop)))
    : typed

  // Counted once per `data`: the compiler drops this file's cache over the 3k-row lists.
  const typeOptions = useMemo(() => countedOptions(data.map(getType)), [data])
  const kindOptions = useMemo(() => countedOptions(data.map(getKind)), [data])
  const shopOptions = useMemo(() => countedOptions(data.flatMap((row) => row.shopNames)), [data])

  return (
    <DataTable
      data={filteredData}
      columns={MATERIALS_COLUMNS}
      storageKey="materials-price-list"
      initialSorting={INITIAL_SORTING}
      enableVirtualization
      virtualContainerHeight={640}
      getRowHref={(row) => `/inwestycje/materialy/${row.id}`}
      aboveToolbar={
        <Description withIcon={false}>
          Widoczne materiały {filteredData.length} / {data.length}
        </Description>
      }
      search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Szukaj materiału...' }}
      filters={
        <>
          <FilterMultiSelect
            label="Rodzaj"
            options={typeOptions}
            values={types}
            onValuesChange={setTypes}
            icon={Tags}
            searchable
            triggerClassName={GRID_FILTER_TRIGGER_CLASS}
          />
          <FilterMultiSelect
            label="Sklep"
            options={shopOptions}
            values={shops}
            onValuesChange={setShops}
            icon={Store}
            searchable
            triggerClassName={GRID_FILTER_TRIGGER_CLASS}
          />
          <FilterMultiSelect
            label="Kategoria"
            options={kindOptions}
            values={kinds}
            onValuesChange={setKinds}
            icon={Boxes}
            triggerClassName={GRID_FILTER_TRIGGER_CLASS}
          />
        </>
      }
      columnToggle
    />
  )
}
