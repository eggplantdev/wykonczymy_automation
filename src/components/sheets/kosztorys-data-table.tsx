'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { DataTableToolbar } from '@/components/ui/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { Button } from '@/components/ui/button'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getKosztorysColumns } from '@/components/tables/sheets'
import type { KosztorysRowT } from '@/types/table-rows'

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
      storageKey="sheets-kosztorys"
      initialSorting={INITIAL_SORTING}
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
          search={{ value: searchTerm, onChange: setSearchTerm }}
          actions={
            <AddSheetDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus />
                  Nowy kosztorys
                </Button>
              }
            />
          }
        />
      )}
    />
  )
}
