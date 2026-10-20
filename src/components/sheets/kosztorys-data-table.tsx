'use client'

import { Plus } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { Button } from '@/components/ui/button'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useReferenceData } from '@/hooks/use-reference-data'
import { getKosztorysColumns } from '@/components/tables/sheets'
import type { KosztorysRowT } from '@/types/table-rows'

type PropsT = {
  data: KosztorysRowT[]
}

const INITIAL_SORTING = [{ id: 'name', desc: false }]

const getSearchableText = (row: KosztorysRowT) => `${row.name} ${row.sheetName}`

export function KosztorysDataTable({ data }: PropsT) {
  const investments = useReferenceData()?.investments ?? []
  const availableInvestments = investments
    .filter((i) => !i.hasSheet)
    .map((i) => ({ id: i.id, name: i.name }))
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)
  const columns = getKosztorysColumns({ availableInvestments })

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
