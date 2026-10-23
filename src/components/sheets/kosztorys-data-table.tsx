'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { AddButton } from '@/components/ui/add-button'
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
      columnToggle
      search={{ value: searchTerm, onChange: setSearchTerm }}
      actions={<AddSheetDialog trigger={<AddButton>Nowy kosztorys</AddButton>} />}
    />
  )
}
