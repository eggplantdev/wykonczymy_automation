'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { DataTableToolbar } from '@/components/ui/data-table/data-table-toolbar'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { Tags, User } from 'lucide-react'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { getCashRegisterColumns, REGISTER_TYPE_LABELS } from '@/components/tables/cash-registers'
import { RegisterBalanceChart } from '@/components/dashboard/register-balance-chart'
import { AddCashRegisterDialog } from '@/components/dialogs/add-cash-register-dialog'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleCashRegisterActive } from '@/lib/actions/toggle-active'
import type { CashRegisterRowT } from '@/types/table-rows'
import type { CashRegisterTypeT, WorkerRefT } from '@/types/reference-data'

const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const getActiveUpdate = (newActive: boolean) => ({ active: newActive })
const getType = (row: CashRegisterRowT) => row.type
const getOwner = (row: CashRegisterRowT) => row.ownerName
const getCashRegisterSearchText = (row: CashRegisterRowT) => `${row.name} ${row.ownerName}`

type CashRegistersTablePropsT = {
  data: CashRegisterRowT[]
  workers: WorkerRefT[]
  className?: string
}

const TYPE_OPTIONS = (Object.keys(REGISTER_TYPE_LABELS) as CashRegisterTypeT[]).map((value) => ({
  value,
  label: REGISTER_TYPE_LABELS[value],
}))

export function CashRegistersTable({ data, workers, className }: CashRegistersTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getActiveUpdate,
    toggleCashRegisterActive,
  )

  const {
    filteredData: activeFiltered,
    showOnlyActive,
    setShowOnlyActive,
  } = useActiveFilter(optimisticData, isCashRegisterActive)

  const ownerOptions = useMemo(() => {
    const uniqueOwners = [...new Set(optimisticData.map((r) => r.ownerName))].filter(Boolean).sort()
    return uniqueOwners.map((name) => ({ value: name, label: name }))
  }, [optimisticData])

  const {
    filteredData: typeFiltered,
    values: typeValues,
    setValues: setTypeValues,
  } = useClientMultiFilter(activeFiltered, getType)

  const {
    filteredData: ownerFiltered,
    values: ownerValues,
    setValues: setOwnerValues,
  } = useClientMultiFilter(typeFiltered, getOwner)
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    ownerFiltered,
    getCashRegisterSearchText,
  )

  const columns = useMemo(() => getCashRegisterColumns(handleToggle), [handleToggle])

  return (
    <>
      <RegisterBalanceChart data={filteredData} />
      <DataTable
        className={className}
        data={filteredData}
        columns={columns}
        storageKey="cashRegisters"
        getRowHref={(row) => `/kasa/${row.id}`}
        getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
        toolbar={({ table, columnVisibility: cv, ...order }) => (
          <DataTableToolbar
            search={{ value: searchTerm, onChange: setSearchTerm }}
            filters={
              <>
                <FilterMultiSelect
                  label="Typ"
                  options={TYPE_OPTIONS}
                  values={typeValues}
                  onValuesChange={setTypeValues}
                  icon={Tags}
                />
                <FilterMultiSelect
                  label="Właściciel"
                  options={ownerOptions}
                  values={ownerValues}
                  onValuesChange={setOwnerValues}
                  icon={User}
                  searchable
                />
                <ActiveFilterButton
                  isActive={showOnlyActive}
                  onChange={setShowOnlyActive}
                  activeLabel="Aktywne"
                  allLabel="Wszystkie"
                />
              </>
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={<AddCashRegisterDialog workers={workers} />}
          />
        )}
      />
    </>
  )
}
