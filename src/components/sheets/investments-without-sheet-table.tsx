'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { useSearchFilter } from '@/hooks/use-search-filter'
import {
  getInvestmentWithoutSheetColumns,
  type InvestmentWithoutSheetRowT,
} from '@/lib/tables/sheets'

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
      initialSorting={INITIAL_SORTING}
      toolbar={() => (
        <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
      )}
    />
  )
}
