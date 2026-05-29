'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { Button } from '@/components/ui/button'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getKosztorysColumns, type KosztorysRowT } from '@/lib/tables/sheets'

type InvestmentOptionT = { id: number; name: string }

type PropsT = {
  data: KosztorysRowT[]
  availableInvestments: InvestmentOptionT[]
}

const INITIAL_SORTING = [{ id: 'name', desc: false }]

const getSearchableText = (row: KosztorysRowT) => `${row.name} ${row.sheetName}`

// Listing of real kosztorysy (linked + unlinked). No status filter — the only
// two states are covered by the sortable Status column.
export function KosztorysDataTable({ data, availableInvestments }: PropsT) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)
  const columns = useMemo(
    () => getKosztorysColumns({ availableInvestments }),
    [availableInvestments],
  )

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      initialSorting={INITIAL_SORTING}
      toolbar={() => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
          <AddSheetDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nowy kosztorys
              </Button>
            }
          />
        </>
      )}
    />
  )
}
