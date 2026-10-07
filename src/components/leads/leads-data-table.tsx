'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ActiveFilterButton } from '@/components/filters/active-filter-button'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination/pagination-footer'
import { getLeadColumns } from '@/components/tables/leads'
import { SelectedIdsContext } from '@/components/tables/data-table/select-column'
import { TrashLeadsButton } from '@/components/leads/trash-leads-button'
import type { InvestmentOptionT } from '@/components/leads/lead-assets-dialog'
import type { LeadRowT } from '@/types/leads'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { useToggleSearchParam } from '@/hooks/use-toggle-search-param'
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
  const noFiles = useToggleSearchParam(LEADS_BASE_URL, 'noFiles')
  // The same whitelist the page used, so a hand-edited `?sort=` it refused cannot leave the header
  // arrow claiming an order the rows were never fetched in.
  const sorting = sortParamToSortingState(validLeadSort(searchParams.get('sort') ?? undefined))

  // Pruned to the rows on screen whenever `data` changes, without an effect: a new page, search,
  // filter or a trash's refresh drops what left, so a selection never reaches rows the user did not
  // see when ticking — while a refresh that keeps the rows („Skontaktowano") keeps the ticks.
  const [selection, setSelection] = useState({ data, ids: NO_SELECTION })
  if (selection.data !== data) {
    const onPage = new Set(data.map((lead) => lead.id))
    setSelection({ data, ids: new Set([...selection.ids].filter((id) => onPage.has(id))) })
  }
  const selectedIds = selection.ids
  // Updaters rather than reads of `selectedIds`, so the column callbacks — and the columns — stay
  // the same object across clicks.
  const updateSelection = (update: (ids: ReadonlySet<number>) => ReadonlySet<number>) =>
    setSelection((prev) => ({ ...prev, ids: update(prev.ids) }))

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
    <SelectedIdsContext value={selectedIds}>
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
                isActive={noFiles.isActive}
                onChange={noFiles.setActive}
                activeLabel="Bez plików"
              />
            }
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={selectedIds.size > 0 && <TrashLeadsButton leadIds={[...selectedIds]} />}
          />
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={LEADS_BASE_URL} />
    </SelectedIdsContext>
  )
}
