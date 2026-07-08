'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { AddWorkerDialog } from '@/components/dialogs/add-worker-dialog'
import { getUserColumns, type UserRowT } from '@/components/tables/users'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleUserActive } from '@/lib/actions/toggle-active'
import type { ReferenceItemT } from '@/types/reference-data'

const isActive = (row: UserRowT) => row.active
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

  const {
    filteredData: activeFiltered,
    showOnlyActive,
    setShowOnlyActive,
  } = useActiveFilter(optimisticData, isActive)

  const getSearchableText = useCallback((row: UserRowT) => `${row.name} ${row.email}`, [])
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    activeFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getUserColumns({ onToggle: handleToggle }), [handleToggle])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="users"
      getRowHref={(row) => `/pracownicy/${row.id}`}
      getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
      toolbar={(table, cv) => (
        <>
          <SearchFilterInput value={searchTerm} onChange={setSearchTerm} />
          <ActiveFilterButton
            isActive={showOnlyActive}
            onChange={setShowOnlyActive}
            activeLabel="Aktywni"
            allLabel="Wszyscy"
          />
          <AddWorkerDialog cashRegisters={cashRegisters} />
          <ColumnToggle table={table} columnVisibility={cv} />
        </>
      )}
    />
  )
}
