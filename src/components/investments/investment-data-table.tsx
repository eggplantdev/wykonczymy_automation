'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getInvestmentColumns, type InvestmentRowT } from '@/components/tables/investments'
import type { ExpenseCategoryRefT } from '@/types/reference-data'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleInvestmentStatus } from '@/lib/actions/toggle-active'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'

const isActive = (row: InvestmentRowT) => row.status === 'active'
const getStatusUpdate = (newActive: boolean) =>
  ({ status: newActive ? 'active' : 'completed' }) as Partial<InvestmentRowT>

type InvestmentDataTablePropsT = {
  data: InvestmentRowT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export function InvestmentDataTable({ data, expenseCategories }: InvestmentDataTablePropsT) {
  const { role: userRole } = useCurrentUser()
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getStatusUpdate,
    toggleInvestmentStatus,
  )

  const {
    filteredData: activeFiltered,
    showOnlyActive,
    setShowOnlyActive,
  } = useActiveFilter(optimisticData, isActive)

  const getSearchableText = useCallback(
    (row: InvestmentRowT) => `${row.name} ${row.address} ${row.contactPerson}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    activeFiltered,
    getSearchableText,
  )

  const columns = useMemo(
    () => getInvestmentColumns({ onToggle: handleToggle, userRole, expenseCategories }),
    [handleToggle, userRole, expenseCategories],
  )

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="investments"
      getRowHref={(row) => `/inwestycje/${row.id}`}
      getRowClassName={(row) => (row.status === 'completed' ? 'opacity-50' : '')}
      toolbar={(table, cv) => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
          <ActiveFilterButton
            isActive={showOnlyActive}
            onChange={setShowOnlyActive}
            activeLabel="Aktywne"
            allLabel="Wszystkie"
          />
          <AddInvestmentDialog />
          <ColumnToggle table={table} columnVisibility={cv} />
        </>
      )}
    />
  )
}
