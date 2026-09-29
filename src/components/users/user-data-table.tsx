'use client'

import { useCallback, useMemo, useState } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { ListFilter } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { AddWorkerDialog } from '@/components/dialogs/add-worker-dialog'
import {
  SettlePayoutsDialog,
  type SettleDialogTargetT,
} from '@/components/dialogs/settle-payouts-dialog'
import { getUserColumns } from '@/components/tables/users'
import type { UserRowT } from '@/types/table-rows'
import { workerPayoutView } from '@/lib/kosztorys/worker-payout-pairs'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { useUserListFilters } from '@/hooks/use-user-list-filters'
import { toggleUserActive } from '@/lib/actions/toggle-active'
import type { ReferenceItemT } from '@/types/reference-data'

const getStatusUpdate = (newActive: boolean) => ({ active: newActive }) as Partial<UserRowT>

type UserDataTablePropsT = {
  data: UserRowT[]
  cashRegisters: ReferenceItemT[]
}

export function UserDataTable({ data, cashRegisters }: UserDataTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getStatusUpdate,
    toggleUserActive,
  )

  const { toggles, togglesBulk, isListed, payoutBuckets } = useUserListFilters()

  const getSearchableText = useCallback((row: UserRowT) => `${row.name} ${row.email}`, [])
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    optimisticData.filter(isListed),
    getSearchableText,
  )

  const [settleTarget, setSettleTarget] = useState<SettleDialogTargetT | null>(null)
  const columns = useMemo(
    () =>
      getUserColumns({
        onToggle: handleToggle,
        onSettle: (worker) => setSettleTarget({ kind: 'worker', id: worker.id, name: worker.name }),
      }),
    [handleToggle],
  )
  // The filter rides on the row, not on the columns: DataTable caches a row's cells, so a filter read
  // from the columns would leave the cells printing the old figures.
  const rows = filteredData.map(
    (row): UserRowT => ({
      ...row,
      payoutRemaining: row.payoutRemaining && workerPayoutView(row.payoutRemaining, payoutBuckets),
    }),
  )

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        storageKey="users"
        getRowHref={(row) => `/pracownicy/${row.id}`}
        getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
        toolbar={({ table, columnVisibility: cv, ...order }) => (
          <DataTableToolbar
            search={{ value: searchTerm, onChange: setSearchTerm }}
            filters={
              <FilterMultiSelect
                label="Filtry"
                icon={ListFilter}
                triggerClassName={GRID_FILTER_TRIGGER_CLASS}
                triggerCount={toggles.filter((toggle) => !toggle.active).length}
                contentClassName="w-80"
                toggles={toggles}
                togglesBulk={togglesBulk}
              />
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={<AddWorkerDialog cashRegisters={cashRegisters} />}
          />
        )}
      />
      <SettlePayoutsDialog target={settleTarget} onClose={() => setSettleTarget(null)} />
    </>
  )
}
