'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { ColumnTotalRow } from '@/components/tables/data-table/column-total-row'
import { COSTS_COLUMN_ID, getFleetColumns } from '@/components/tables/fleet'
import { AddVehicleDialog } from '@/components/dialogs/add-vehicle-dialog'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { sumKnown } from '@/lib/utils/sum-known'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import type { FleetRowT } from '@/lib/fleet/types'

const getSearchableText = (row: FleetRowT) =>
  `${row.registration} ${row.make} ${row.model} ${row.vin}`

export function FleetDataTable({ data }: { data: FleetRowT[] }) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)

  const columns = getFleetColumns()

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="fleet"
      getRowHref={(row) => `/flota/${row.id}`}
      getRowClassName={(row) => (row.status === 'RETIRED' ? 'opacity-60' : '')}
      footer={(visibleColumnIds) => (
        <ColumnTotalRow
          visibleColumnIds={visibleColumnIds}
          columnId={COSTS_COLUMN_ID}
          label="Razem"
        >
          {formatPLNOrDash(sumKnown(filteredData.map((row) => row.totalCosts)))}
        </ColumnTotalRow>
      )}
      search={{ value: searchTerm, onChange: setSearchTerm }}
      columnToggle
      actions={
        <>
          <AddInspectionDialog vehicles={data} />
          <AddVehicleDialog />
        </>
      }
    />
  )
}
