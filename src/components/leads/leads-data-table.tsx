'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { getLeadColumns } from '@/components/tables/leads'
import type { LeadRowT } from '@/types/leads'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import { validLeadSort } from '@/lib/queries/lead-sort'
import { toggleLeadContactStatus } from '@/lib/actions/toggle-lead-contact-status'

const LEADS_BASE_URL = '/zgloszenia'
const SEARCH_DEBOUNCE_MS = 300

const getContactStatusUpdate = (contacted: boolean) =>
  ({ contactStatus: contacted ? 'contacted' : 'new' }) as Partial<LeadRowT>

type LeadsDataTablePropsT = {
  data: LeadRowT[]
  paginationMeta: PaginationMetaT
}

export function LeadsDataTable({ data, paginationMeta }: LeadsDataTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getContactStatusUpdate,
    toggleLeadContactStatus,
  )

  const searchParams = useSearchParams()
  const { updateParam } = useUrlFilterParams(LEADS_BASE_URL)
  // The same whitelist the page used, so a hand-edited `?sort=` it refused cannot leave the header
  // arrow claiming an order the rows were never fetched in.
  const sorting = sortParamToSortingState(validLeadSort(searchParams.get('sort') ?? undefined))

  const columns = useMemo(() => getLeadColumns({ onToggle: handleToggle }), [handleToggle])

  return (
    <div>
      <DataTable
        data={optimisticData}
        columns={columns}
        storageKey="leads"
        sorting={sorting}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
        toolbar={({ table, columnVisibility: cv, ...order }) => (
          <DataTableToolbar
            search={{
              value: searchParams.get('search') ?? '',
              onChange: (value) => updateParam('search', value),
              placeholder: 'Szukaj zgłoszenia...',
              debounceMs: SEARCH_DEBOUNCE_MS,
            }}
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
          />
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={LEADS_BASE_URL} />
    </div>
  )
}
