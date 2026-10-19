'use client'

import { useState } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { ListFilter } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { Description } from '@/components/ui/description'
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
import type { RoleT } from '@/lib/auth/roles'
import type { ReferenceItemT } from '@/types/reference-data'

const getStatusUpdate = (newActive: boolean) => ({ active: newActive }) as Partial<UserRowT>

type UserDataTablePropsT = {
  data: UserRowT[]
  cashRegisters: ReferenceItemT[]
  assignableRoles: RoleT[]
}

const getSearchableText = (row: UserRowT) => `${row.name} ${row.email}`

export function UserDataTable({ data, cashRegisters, assignableRoles }: UserDataTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getStatusUpdate,
    toggleUserActive,
  )

  const { toggles, clear, isListed, payoutBuckets } = useUserListFilters()

  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    optimisticData.filter(isListed),
    getSearchableText,
  )

  const [settleTarget, setSettleTarget] = useState<SettleDialogTargetT | null>(null)
  const columns = getUserColumns({
    onToggle: handleToggle,
    onSettle: (worker) => setSettleTarget({ kind: 'worker', id: worker.id, name: worker.name }),
  })
  // The filter rides on the row, not on the columns: the column's sort accessor reads
  // `row.payoutRemaining`, so a filter applied only in the cell would sort by the unfiltered figure.
  const rows = filteredData.map(
    (row): UserRowT => ({
      ...row,
      payoutRemaining: row.payoutRemaining && workerPayoutView(row.payoutRemaining, payoutBuckets),
    }),
  )

  return (
    <>
      <Description withIcon={false}>
        Widoczni pracownicy {rows.length} / {data.length}
      </Description>
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
                contentClassName="w-80"
                toggles={toggles}
                onClearToggles={clear}
              />
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={<AddWorkerDialog cashRegisters={cashRegisters} roles={assignableRoles} />}
          />
        )}
      />
      <SettlePayoutsDialog target={settleTarget} onClose={() => setSettleTarget(null)} />
    </>
  )
}
