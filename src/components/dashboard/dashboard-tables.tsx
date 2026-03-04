'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getCashRegisterColumns } from '@/lib/tables/cash-registers'
import { getUserColumns } from '@/lib/tables/users'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleCashRegisterActive, toggleUserActive } from '@/lib/actions/toggle-active'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const isUserActive = (row: UserRowT) => row.active
const getActiveUpdate = (newActive: boolean) => ({ active: newActive })

type CashRegistersTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
  className?: string
}

function CashRegistersTable({ data, className }: CashRegistersTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getActiveUpdate,
    toggleCashRegisterActive,
  )

  const { filteredData, showOnlyActive, setShowOnlyActive } = useActiveFilter(
    optimisticData,
    isCashRegisterActive,
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
        <ActiveFilterButton
          isActive={showOnlyActive}
          onChange={setShowOnlyActive}
          activeLabel="Aktywne"
          allLabel="Wszystkie"
        />
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
      <CollapsibleSection title="Kasy">
        <div className="mt-4">
          <CashRegistersTable data={cashRegisters} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Pracownicy">
        <div className="mt-4">
          <UsersTable data={users} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Inwestycje">
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
