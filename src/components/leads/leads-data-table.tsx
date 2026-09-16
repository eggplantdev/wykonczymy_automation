'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { getLeadColumns } from '@/components/tables/leads'
import type { LeadRowT } from '@/types/leads'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleLeadContactStatus } from '@/lib/actions/toggle-lead-contact-status'

const getContactStatusUpdate = (contacted: boolean) =>
  ({ contactStatus: contacted ? 'contacted' : 'new' }) as Partial<LeadRowT>

export function LeadsDataTable({ data }: { data: LeadRowT[] }) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getContactStatusUpdate,
    toggleLeadContactStatus,
  )

  const getSearchableText = useCallback(
    (row: LeadRowT) => `${row.name} ${row.email} ${row.phone} ${row.formName}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    optimisticData,
    getSearchableText,
  )

  const columns = useMemo(() => getLeadColumns({ onToggle: handleToggle }), [handleToggle])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="leads"
      initialSorting={[{ id: 'submittedAt', desc: true }]}
      toolbar={({ table, columnVisibility: cv, ...order }) => (
        <DataTableToolbar
          search={{ value: searchTerm, onChange: setSearchTerm }}
          columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
        />
      )}
    />
  )
}
