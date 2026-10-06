'use client'

import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { QueueFilters } from '@/components/filters/queue-filters'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { Button } from '@/components/ui/button'
import { PaginationFooter } from '@/components/ui/pagination/pagination-footer'
import { RestoreExpenseDraftButton } from '@/components/worker-expenses/restore-expense-draft-button'
import { useExpenseDraftAcceptance } from '@/components/worker-expenses/use-expense-draft-acceptance'
import { useTranslation } from '@/hooks/use-translation'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import {
  DRAFT_STATUS_LABEL_KEYS,
  EXPENSE_DRAFT_STATUSES,
} from '@/lib/constants/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { validExpenseDraftSort } from '@/lib/queries/expense-draft-sort'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { ReferenceDataT, ReferenceItemT } from '@/types/reference-data'

const EXPENSE_DRAFTS_BASE_URL = '/zgloszenia-wydatkow'

type PropsT = {
  data: ExpenseDraftRowT[]
  paginationMeta: PaginationMetaT
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  referenceData: ReferenceDataT
}

export function ExpenseDraftsDataTable({
  data,
  paginationMeta,
  investments,
  workers,
  referenceData,
}: PropsT) {
  const searchParams = useSearchParams()
  const { updateParam } = useUrlFilterParams(EXPENSE_DRAFTS_BASE_URL)
  const { t } = useTranslation('expenseDrafts')
  const { open, loadingId, dialogs } = useExpenseDraftAcceptance(referenceData)
  const columns = useExpenseDraftColumns({
    isManagerView: true,
    actions: (draft) => {
      if (draft.status === 'rejected') return <RestoreExpenseDraftButton draftId={draft.id} />
      if (draft.status !== 'pending') return null
      return (
        <Button size="sm" disabled={loadingId !== undefined} onClick={() => open(draft)}>
          {loadingId === draft.id && <Loader2 className="animate-spin" />}
          Zobacz
        </Button>
      )
    },
  })

  return (
    <>
      <QueueFilters
        baseUrl={EXPENSE_DRAFTS_BASE_URL}
        statusOptions={EXPENSE_DRAFT_STATUSES.map((status) => ({
          value: status,
          label: t(DRAFT_STATUS_LABEL_KEYS[status]),
        }))}
        investments={investments}
        workers={workers}
      />
      <DataTable
        data={data}
        columns={columns}
        storageKey="expense-drafts"
        sorting={sortParamToSortingState(
          validExpenseDraftSort(searchParams.get('sort') ?? undefined),
        )}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={EXPENSE_DRAFTS_BASE_URL} />
      {dialogs}
    </>
  )
}
