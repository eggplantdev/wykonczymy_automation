'use client'

import { useCallback, useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { Tags, User } from 'lucide-react'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getCashRegisterColumns, REGISTER_TYPE_LABELS } from '@/lib/tables/cash-registers'
import { getUserColumns } from '@/lib/tables/users'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { SECTION_IDS } from '@/lib/constants/sections'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleCashRegisterActive, toggleUserActive } from '@/lib/actions/toggle-active'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const isUserActive = (row: UserRowT) => row.active
const getActiveUpdate = (newActive: boolean) => ({ active: newActive })

type CashRegistersTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
  className?: string
}

function useClientMultiFilter<TItem>(
  data: readonly TItem[],
  accessor: (item: TItem) => string,
  allValues: readonly string[],
) {
  const [values, setValues] = useState<string[]>([])

  const filteredData = useMemo(() => {
    const hasNone = values.length === 1 && values[0] === FILTER_NONE
    if (hasNone) return []
    if (values.length === 0) return data
    return data.filter((item) => values.includes(accessor(item)))
  }, [data, values, accessor])

  return { filteredData, values, setValues } as const
}

function CashRegistersTable({ data, className }: CashRegistersTablePropsT) {
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

  const typeOptions = useMemo(
    () =>
      (Object.keys(REGISTER_TYPE_LABELS) as CashRegisterTypeT[]).map((value) => ({
        value,
        label: REGISTER_TYPE_LABELS[value],
      })),
    [],
  )

  const ownerOptions = useMemo(() => {
    const uniqueOwners = [...new Set(optimisticData.map((r) => r.ownerName))].filter(Boolean).sort()
    return uniqueOwners.map((name) => ({ value: name, label: name }))
  }, [optimisticData])

  const getType = useCallback((row: CashRegisterRowT) => row.type, [])
  const getOwner = useCallback((row: CashRegisterRowT) => row.ownerName, [])

  const allTypes = useMemo(() => typeOptions.map((o) => o.value), [typeOptions])
  const allOwners = useMemo(() => ownerOptions.map((o) => o.value), [ownerOptions])

  const {
    filteredData: typeFiltered,
    values: typeValues,
    setValues: setTypeValues,
  } = useClientMultiFilter(activeFiltered, getType, allTypes)

  const {
    filteredData: ownerFiltered,
    values: ownerValues,
    setValues: setOwnerValues,
  } = useClientMultiFilter(typeFiltered, getOwner, allOwners)

  const getSearchableText = useCallback(
    (row: CashRegisterRowT) => `${row.name} ${row.ownerName}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    ownerFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getCashRegisterColumns(handleToggle), [handleToggle])

  return (
    <DataTable
      className={className}
      data={filteredData}
      columns={columns}
      getRowHref={(row) => `/kasa/${row.id}`}
      getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
      toolbar={() => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
          <FilterMultiSelect
            label="Typ"
            options={typeOptions}
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
      )}
    />
  )
}

type DashboardTablesPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly investments: readonly InvestmentRowT[]
  readonly users: readonly UserRowT[]
}

export function DashboardTables({ cashRegisters, investments, users }: DashboardTablesPropsT) {
  return (
    <div className="mt-8 space-y-8">
      <CollapsibleSection title="Kasy" id={SECTION_IDS.cashRegisters}>
        <div className="mt-4">
          <CashRegistersTable data={cashRegisters} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Pracownicy" id={SECTION_IDS.employees}>
        <div className="mt-4">
          <UsersTable data={users} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Inwestycje" id={SECTION_IDS.investments}>
        <div className="mt-4">
          <InvestmentDataTable data={investments} />
        </div>
      </CollapsibleSection>
    </div>
  )
}

type UsersTablePropsT = {
  readonly data: readonly UserRowT[]
}

function UsersTable({ data }: UsersTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getActiveUpdate,
    toggleUserActive,
  )

  const {
    filteredData: activeFiltered,
    showOnlyActive,
    setShowOnlyActive,
  } = useActiveFilter(optimisticData, isUserActive)

  const getSearchableText = useCallback((row: UserRowT) => `${row.name} ${row.email}`, [])
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    activeFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getUserColumns(handleToggle), [handleToggle])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      getRowHref={(row) => `/uzytkownicy/${row.id}`}
      getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
      toolbar={() => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
          <ActiveFilterButton
            isActive={showOnlyActive}
            onChange={setShowOnlyActive}
            activeLabel="Aktywni"
            allLabel="Wszyscy"
          />
        </>
      )}
    />
  )
}
