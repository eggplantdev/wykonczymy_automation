'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ActiveFilterButton } from '@/components/filters/active-filter-button'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { getLeadColumns, SelectedLeadIdsContext } from '@/components/tables/leads'
import { TrashLeadsButton } from '@/components/leads/trash-leads-button'
import type { InvestmentOptionT } from '@/components/leads/lead-assets-dialog'
import type { LeadRowT } from '@/types/leads'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import { validLeadSort } from '@/lib/queries/lead-sort'
import { toggleLeadContactStatus } from '@/lib/actions/toggle-lead-contact-status'

const LEADS_BASE_URL = '/zgloszenia'
const SEARCH_DEBOUNCE_MS = 300
const NO_SELECTION: ReadonlySet<number> = new Set()

const getContactStatusUpdate = (contacted: boolean) =>
  ({ contactStatus: contacted ? 'contacted' : 'new' }) as Partial<LeadRowT>

type LeadsDataTablePropsT = {
  data: LeadRowT[]
  paginationMeta: PaginationMetaT
  /** Targets for „Załączniki" — trimmed to id + name by the page, since the row shape is PII. */
  investments: InvestmentOptionT[]
}

export function LeadsDataTable({ data, paginationMeta, investments }: LeadsDataTablePropsT) {
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

  // Keyed to the `data` it was made on, so a new page, search, filter or a trash's refresh drops it
  // without an effect: a selection must never reach rows the user did not see when ticking.
  const [selection, setSelection] = useState({ data, ids: NO_SELECTION })
  const selectedIds = selection.data === data ? selection.ids : NO_SELECTION
  // Updaters rather than reads of `selectedIds`, so the column callbacks — and the columns — stay
  // the same object across clicks.
  const updateSelection = (update: (ids: ReadonlySet<number>) => ReadonlySet<number>) =>
    setSelection((prev) => ({ data, ids: update(prev.data === data ? prev.ids : NO_SELECTION) }))

  const toggleSelect = (id: number) =>
    updateSelection((ids) => {
      const next = new Set(ids)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const togglePage = (pageIds: number[]) =>
    updateSelection((ids) => (pageIds.every((id) => ids.has(id)) ? NO_SELECTION : new Set(pageIds)))

  const columns = getLeadColumns({
    onToggle: handleToggle,
    investments,
    onToggleSelect: toggleSelect,
    onTogglePage: togglePage,
  })

  return (
    <SelectedLeadIdsContext value={selectedIds}>
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
            filters={
              <ActiveFilterButton
                isActive={searchParams.get('noFiles') === '1'}
                onChange={(on) => updateParam('noFiles', on ? '1' : '')}
                activeLabel="Bez plików"
              />
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={
              selectedIds.size > 0 && (
                <TrashLeadsButton
                  leadIds={[...selectedIds]}
                  onTrashed={() => updateSelection(() => NO_SELECTION)}
                />
              )
            }
          />
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={LEADS_BASE_URL} />
    </SelectedLeadIdsContext>
  )
}
