'use client'

import { useState } from 'react'
import { CircleDot, Landmark } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { ControlGrid } from '@/components/ui/control-grid'
import { PageNav } from '@/components/ui/pagination/page-nav'
import { PaginationBar } from '@/components/ui/pagination/pagination-bar'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useTranslation } from '@/hooks/use-translation'
import {
  DRAFT_STATUS_LABEL_KEYS,
  EXPENSE_DRAFT_STATUSES,
  NO_INVESTMENT,
} from '@/lib/constants/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'

// The page also pages and filters transfers through the URL, so this table keeps its page, limit and
// filters in state — two URL-driven tables on one page would fight over `page` / `limit` / `investment`.
const DEFAULT_PAGE_SIZE = 10

const getStatus = (draft: ExpenseDraftRowT) => draft.status
const DEFAULT_STATUS_FILTER = ['pending']
const getInvestment = (draft: ExpenseDraftRowT) =>
  draft.investmentId === null ? NO_INVESTMENT : String(draft.investmentId)

type PropsT = {
  drafts: ExpenseDraftRowT[]
  canSend: boolean
  canOpenTransfers: boolean
}

export function WorkerExpenseDraftsTable({ drafts, canSend, canOpenTransfers }: PropsT) {
  const { t } = useTranslation('expenseDrafts')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const newestDraftId = Math.max(0, ...drafts.map((draft) => draft.id))
  const [seenNewestDraftId, setSeenNewestDraftId] = useState(newestDraftId)
  // A draft he just sent is listed on page 1 — left on page 3 he would not see it land.
  if (newestDraftId > seenNewestDraftId) {
    setSeenNewestDraftId(newestDraftId)
    setPage(1)
  }

  const {
    filteredData: byStatus,
    values: statusFilter,
    setValues: setStatusFilter,
  } = useClientMultiFilter(drafts, getStatus, DEFAULT_STATUS_FILTER)
  const {
    filteredData: filtered,
    values: investmentFilter,
    setValues: setInvestmentFilter,
  } = useClientMultiFilter(byStatus, getInvestment)
  const hasActions = canSend && filtered.some((draft) => draft.status === 'pending')
  const columns = useExpenseDraftColumns({
    isManagerView: false,
    canOpenTransfers,
    actions: hasActions
      ? (draft) =>
          draft.status === 'pending' &&
          !draft.progress?.accepted && (
            <DeleteExpenseDraftButton
              draftId={draft.id}
              investmentName={draft.investmentName ?? t('noInvestment')}
            />
          )
      : undefined,
  })

  const investmentOptions = [
    ...new Map(
      drafts.map((draft) => [getInvestment(draft), draft.investmentName ?? t('noInvestment')]),
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const totalPages = Math.ceil(filtered.length / pageSize)
  // A delete can shrink the list under the page the worker is on.
  const currentPage = Math.min(page, Math.max(1, totalPages))

  function narrow(apply: () => void) {
    apply()
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3">
      <ControlGrid>
        <FilterMultiSelect
          values={statusFilter}
          onValuesChange={(values) => narrow(() => setStatusFilter(values))}
          options={EXPENSE_DRAFT_STATUSES.map((status) => ({
            value: status,
            label: t(DRAFT_STATUS_LABEL_KEYS[status]),
          }))}
          label={t('status')}
          icon={CircleDot}
        />
        <FilterMultiSelect
          values={investmentFilter}
          onValuesChange={(values) => narrow(() => setInvestmentFilter(values))}
          options={investmentOptions}
          label={t('investment')}
          icon={Landmark}
          searchable
        />
      </ControlGrid>
      <DataTable
        data={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
        columns={columns}
        storageKey="worker-expense-drafts"
      />
      <PaginationBar
        totalDocs={filtered.length}
        limit={pageSize}
        onLimitChange={(limit) => narrow(() => setPageSize(limit))}
        className="mt-0"
      >
        <PageNav
          currentPage={currentPage}
          totalPages={totalPages}
          renderPage={(target, isInert, children) => (
            <button type="button" disabled={isInert} onClick={() => setPage(target)}>
              {children}
            </button>
          )}
        />
      </PaginationBar>
    </div>
  )
}
