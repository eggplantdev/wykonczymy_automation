'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getInvestmentColumns, type InvestmentRowT } from '@/lib/tables/investments'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleInvestmentStatus } from '@/lib/actions/toggle-active'

const isActive = (row: InvestmentRowT) => row.status === 'active'
const getStatusUpdate = (newActive: boolean) =>
  ({ status: newActive ? 'active' : 'completed' }) as Partial<InvestmentRowT>

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
}

export function InvestmentDataTable({ data }: InvestmentDataTablePropsT) {
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

  const columns = useMemo(() => getInvestmentColumns(handleToggle), [handleToggle])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      emptyMessage="Brak inwestycji"
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
          <ColumnToggle table={table} columnVisibility={cv} />
        </>
      )}
    />
  )
}
