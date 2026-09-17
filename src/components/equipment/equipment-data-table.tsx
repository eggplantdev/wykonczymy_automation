'use client'

import { useCallback, useMemo } from 'react'
import { CircleDot, MapPin } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { AddEquipmentDialog } from '@/components/dialogs/add-equipment-dialog'
import { getEquipmentColumns } from '@/components/tables/equipment'
import { whereFilterOptions, whereFilterValue } from '@/components/equipment/where-filter-options'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  isLiveStatus,
} from '@/lib/equipment/equipment-status'
import type { EquipmentRowT, WarehouseOptionT } from '@/lib/equipment/types'
import type { DayT } from '@/lib/utils/days'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

type EquipmentDataTablePropsT = {
  data: EquipmentRowT[]
  today: DayT
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
}

const INITIAL_SORTING = [{ id: 'name', desc: false }]

// From the constant, not from the data: unlike „Gdzie jest", the five statuses are a closed list, and
// an owner looking for a skradziony item needs the option to exist before any row carries it.
const STATUS_OPTIONS = EQUIPMENT_STATUSES.map((status) => ({
  value: status,
  label: EQUIPMENT_STATUS_LABELS[status].pl,
}))

const statusFilterValue = (row: EquipmentRowT) => row.status

export function EquipmentDataTable({
  data,
  today,
  workers,
  warehouses,
  investments,
}: EquipmentDataTablePropsT) {
  // Serial numbers are what someone reads off the nameplate while standing next to the tool, so they
  // search alongside the words. `useSearchFilter` folds diacritics, so „szlifierka" finds „Szlifierka".
  const getSearchableText = useCallback(
    (row: EquipmentRowT) => `${row.name} ${row.make} ${row.model} ${row.serialNumber}`,
    [],
  )
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(data, getSearchableText)

  const {
    filteredData: byStatus,
    values: statuses,
    setValues: setStatuses,
  } = useClientMultiFilter(searched, statusFilterValue)

  const {
    filteredData,
    values: places,
    setValues: setPlaces,
  } = useClientMultiFilter(byStatus, whereFilterValue)

  // From `data`, never from `filteredData`: options built off the filtered set vanish as soon as the
  // last matching row is hidden, and the filter can then no longer be undone.
  const placeOptions = useMemo(() => whereFilterOptions(data), [data])

  const columns = useMemo(
    () => getEquipmentColumns({ today, workers, warehouses, investments }),
    [today, workers, warehouses, investments],
  )

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="equipment"
      initialSorting={INITIAL_SORTING}
      getRowHref={(row) => `/sprzet/${row.id}`}
      // Sold, lost and retired items stay listed — the register is also the record of what we USED to
      // have — but they are visibly out of the working set.
      getRowClassName={(row) => (isLiveStatus(row.status) ? '' : 'opacity-60')}
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: 'Szukaj sprzętu...',
          }}
          filters={
            <>
              <FilterMultiSelect
                label="Gdzie jest"
                options={placeOptions}
                values={places}
                onValuesChange={setPlaces}
                icon={MapPin}
                searchable
                triggerClassName={GRID_FILTER_TRIGGER_CLASS}
              />
              <FilterMultiSelect
                label="Status"
                options={STATUS_OPTIONS}
                values={statuses}
                onValuesChange={setStatuses}
                icon={CircleDot}
                triggerClassName={GRID_FILTER_TRIGGER_CLASS}
              />
            </>
          }
          actions={
            <AddEquipmentDialog
              workers={workers}
              warehouses={warehouses}
              investments={investments}
            />
          }
        />
      )}
    />
  )
}
