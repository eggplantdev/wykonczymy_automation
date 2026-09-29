'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { ColumnTotalRow } from '@/components/tables/data-table/column-total-row'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { COSTS_COLUMN_ID, getFleetColumns } from '@/components/tables/fleet'
import { AddVehicleDialog } from '@/components/dialogs/add-vehicle-dialog'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { sumKnown } from '@/lib/utils/sum-known'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import type { FleetRowT } from '@/types/fleet'

export function FleetDataTable({ data }: { data: FleetRowT[] }) {
  const getSearchableText = useCallback(
    (row: FleetRowT) => `${row.registration} ${row.make} ${row.model} ${row.vin}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)

  const columns = useMemo(() => getFleetColumns(), [])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="fleet"
      getRowHref={(row) => `/flota/${row.id}`}
      // Retired cars stay listed — their history is still the answer to "when did we last…".
      getRowClassName={(row) => (row.status === 'RETIRED' ? 'opacity-60' : '')}
      // Summed from the rendered rows, so the total matches what the search box left on screen.
      footer={(visibleColumnIds) => (
        <ColumnTotalRow
          visibleColumnIds={visibleColumnIds}
          columnId={COSTS_COLUMN_ID}
          label="Razem"
        >
          {formatPLNOrDash(sumKnown(filteredData.map((row) => row.totalCosts)))}
        </ColumnTotalRow>
      )}
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          search={{ value: searchTerm, onChange: setSearchTerm }}
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
          actions={
            <>
              <AddInspectionDialog vehicles={data} />
              <AddVehicleDialog />
            </>
          }
        />
      )}
    />
  )
}
