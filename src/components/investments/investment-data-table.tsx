'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { StatusFilter } from '@/components/investments/status-filter'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getInvestmentColumns, type InvestmentRowT } from '@/components/tables/investments'
import type { ExpenseCategoryRefT } from '@/types/reference-data'
import { useStatusFilter } from '@/hooks/use-status-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'
import type { PresetMetaT } from '@/lib/db/presets'

const getStatus = (row: InvestmentRowT) => row.status

type InvestmentDataTablePropsT = {
  data: InvestmentRowT[]
  expenseCategories: ExpenseCategoryRefT[]
  presets: PresetMetaT[]
}

export function InvestmentDataTable({
  data,
  expenseCategories,
  presets,
}: InvestmentDataTablePropsT) {
  const { role: userRole } = useCurrentUser()

  const {
    filteredData: statusFiltered,
    selectedStatuses,
    toggleStatus,
  } = useStatusFilter(data, getStatus)

  const getSearchableText = useCallback(
    (row: InvestmentRowT) => `${row.name} ${row.address} ${row.contactPerson}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    statusFiltered,
    getSearchableText,
  )

  const columns = useMemo(
    () => getInvestmentColumns({ userRole, expenseCategories }),
    [userRole, expenseCategories],
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
          <StatusFilter selectedStatuses={selectedStatuses} onToggle={toggleStatus} />
          <AddInvestmentDialog presets={presets} />
          <ColumnToggle table={table} columnVisibility={cv} />
        </>
      )}
    />
  )
}
