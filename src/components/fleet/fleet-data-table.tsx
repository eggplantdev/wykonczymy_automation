'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/filters/column-toggle'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { COSTS_COLUMN_ID, getFleetColumns } from '@/components/tables/fleet'
import { DateFilters } from '@/components/filters/date-filters'
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
    <div className="flex flex-col gap-3">
      {/* Its own row rather than the toolbar's: the bar is a five-column grid, not a toolbar chip. */}
      <DateFilters baseUrl="/flota" />
      <DataTable
        data={filteredData}
        columns={columns}
        storageKey="fleet"
        getRowHref={(row) => `/flota/${row.id}`}
        // Retired cars stay listed — their history is still the answer to "when did we last…" — but they
        // are visibly out of the working set.
        getRowClassName={(row) => (row.status === 'RETIRED' ? 'opacity-60' : '')}
        // Summed from the rows the table is actually rendering, so the total always matches what the
        // search box left on screen instead of quoting a number nobody can see.
        footer={(visibleColumnIds) => {
          const costsIndex = visibleColumnIds.indexOf(COSTS_COLUMN_ID)
          if (costsIndex < 0) return null

          return (
            <tr>
              {/* Nothing to its left once every other column is toggled off — the number is what the
                  row is for, so it survives losing its label rather than the footer disappearing. */}
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
          <>
            <SearchFilterInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Szukaj..."
              className={SEARCH_FILTER_TOOLBAR_WIDTH}
            />
            <ColumnToggle table={table} columnVisibility={cv} {...order} />
            <AddInspectionDialog vehicles={data} />
            <AddVehicleDialog />
          </>
        )}
      />
    </div>
  )
}
