'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getInvestmentWithoutSheetColumns } from '@/components/tables/sheets'
import type { InvestmentWithoutSheetRowT } from '@/types/table-rows'

type PropsT = {
  data: InvestmentWithoutSheetRowT[]
}

const INITIAL_SORTING = [{ id: 'name', desc: false }]

const getSearchableText = (row: InvestmentWithoutSheetRowT) => row.name

// Listing of investments that have no kosztorys yet — distinct entity from the
// Kosztorysy table above; the only action is to attach a kosztorys.
export function InvestmentsWithoutSheetTable({ data }: PropsT) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)
  const columns = useMemo(() => getInvestmentWithoutSheetColumns(), [])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="investments-without-sheet"
      initialSorting={INITIAL_SORTING}
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          search={{ value: searchTerm, onChange: setSearchTerm }}
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
        />
      )}
    />
  )
}
