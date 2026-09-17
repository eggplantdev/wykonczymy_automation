'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
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
      footer={(visibleColumnIds) => {
        const costsIndex = visibleColumnIds.indexOf(COSTS_COLUMN_ID)
        if (costsIndex < 0) return null

        return (
          <tr>
            {/* Nothing to its left once every other column is toggled off — the number is what the
                  row is for, so it survives losing its label. */}
            {costsIndex > 0 && (
              <td className="font-bold" colSpan={costsIndex}>
                Razem
              </td>
            )}
            <td className="text-right font-bold tabular-nums">
              {formatPLNOrDash(sumKnown(filteredData.map((row) => row.totalCosts)))}
            </td>
            {visibleColumnIds.slice(costsIndex + 1).map((id) => (
              <td key={id} />
            ))}
          </tr>
        )
      }}
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
