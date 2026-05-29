'use client'

import { useMemo, useState } from 'react'
import { Plus, ListFilter } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { Button } from '@/components/ui/button'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getSheetColumns, type SheetStatusT, type SheetTableRowT } from '@/lib/tables/sheets'

type InvestmentOptionT = { id: number; name: string }

type SheetDataTablePropsT = {
  data: SheetTableRowT[]
  availableInvestments: InvestmentOptionT[]
}

const INITIAL_SORTING = [{ id: 'name', desc: false }]

const STATUS_OPTIONS: Array<{ value: SheetStatusT; label: string }> = [
  { value: 'linked', label: 'Powiązane' },
  { value: 'unlinked', label: 'Bez inwestycji' },
  { value: 'no-sheet', label: 'Bez kosztorysu' },
]
const ALL_STATUSES = STATUS_OPTIONS.map((o) => o.value)

const getSearchableText = (row: SheetTableRowT) => `${row.name} ${row.sheetName ?? ''}`

// Mirror FilterMultiSelect's URL encoding for in-memory use: [] = all (no
// filter), [FILTER_NONE] = nothing selected, otherwise the explicit subset.
function deriveSelected(values: string[]): string[] {
  if (values.length === 1 && values[0] === FILTER_NONE) return []
  if (values.length === 0) return ALL_STATUSES
  return values
}

export function SheetDataTable({ data, availableInvestments }: SheetDataTablePropsT) {
  // Default to showing only linked kosztorysy (Powiązane); the other statuses
  // (Bez inwestycji / Bez kosztorysu) stay one filter-click away.
  const [statusValues, setStatusValues] = useState<string[]>(['linked'])

  const statusFiltered = useMemo(() => {
    const selected = deriveSelected(statusValues)
    if (selected.length === ALL_STATUSES.length) return data
    return data.filter((row) => selected.includes(row.status))
  }, [data, statusValues])

  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    statusFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getSheetColumns({ availableInvestments }), [availableInvestments])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      initialSorting={INITIAL_SORTING}
      toolbar={() => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
          <FilterMultiSelect
            values={statusValues}
            onValuesChange={setStatusValues}
            options={STATUS_OPTIONS}
            label="Status"
            icon={ListFilter}
          />
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
