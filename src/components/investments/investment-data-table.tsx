'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { StatusFilter } from '@/components/investments/status-filter'
import { getInvestmentColumns, V2_COLUMN_IDS } from '@/components/tables/investments'
import { ActiveFilterButton } from '@/components/filters/active-filter-button'
import type { InvestmentRowT } from '@/types/table-rows'
import { useStatusFilter } from '@/hooks/use-status-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'
import type { PresetMetaT } from '@/lib/db/presets'

const getStatus = (row: InvestmentRowT) => row.status

type InvestmentDataTablePropsT = {
  data: InvestmentRowT[]
  presets: PresetMetaT[]
}

export function InvestmentDataTable({ data, presets }: InvestmentDataTablePropsT) {
  const { role: userRole } = useCurrentUser()

  const {
    filteredData: statusFiltered,
    selectedStatuses,
    toggleStatus,
  } = useStatusFilter(data, getStatus, 'investments')

  const getSearchableText = useCallback(
    (row: InvestmentRowT) => `${row.name} ${row.address} ${row.contactPerson}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    statusFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getInvestmentColumns({ userRole }), [userRole])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="investments"
      getRowHref={(row) => `/inwestycje/${row.id}`}
      getRowClassName={(row) => (row.status === 'completed' ? 'opacity-50' : '')}
      toolbar={({ table, columnVisibility: cv, ...order }) => {
        // Ticked unless the picker (or a previous untick) has switched one off — absent from the
        // stored state means visible, which is what „domyślnie zaznaczony" has to mean here.
        const v2Shown = V2_COLUMN_IDS.every((id) => cv[id] !== false)
        return (
          <DataTableToolbar
            search={{ value: searchTerm, onChange: setSearchTerm }}
            filters={
              <>
                <StatusFilter selectedStatuses={selectedStatuses} onToggle={toggleStatus} />
                {/* One switch for the whole kosztorys-sourced half. It narrows what the table shows,
                  so it sits with the filters and wears their button — a lone checkbox in the toolbar
                  was the only control on any table that asked to be read rather than pressed.
                  Flipping it writes the same visibility state the picker does, so the two never
                  disagree about what is on screen. */}
                <ActiveFilterButton
                  isActive={v2Shown}
                  onChange={(next) =>
                    table.setColumnVisibility((prev) => ({
                      ...prev,
                      ...Object.fromEntries(V2_COLUMN_IDS.map((id) => [id, next])),
                    }))
                  }
                  activeLabel="Kolumny v2"
                />
              </>
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={<AddInvestmentDialog presets={presets} />}
          />
        )
      }}
    />
  )
}
