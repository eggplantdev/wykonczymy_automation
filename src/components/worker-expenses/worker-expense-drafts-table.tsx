'use client'

import { useState } from 'react'
import { CircleDot, Landmark } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { ControlGrid } from '@/components/ui/control-grid'
import { PageNav } from '@/components/ui/pagination/page-nav'
import { PaginationBar } from '@/components/ui/pagination/pagination-bar'
import { DRAFT_STATUS_LABEL_KEYS } from '@/components/worker-expenses/draft-status-badge'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import { useTranslation } from '@/hooks/use-translation'
import { EXPENSE_DRAFT_STATUSES } from '@/lib/constants/worker-expense-drafts'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'

// The page also pages and filters transfers through the URL, so this table keeps its page, limit and
// filters in state — two URL-driven tables on one page would fight over `page` / `limit` / `investment`.
const DEFAULT_PAGE_SIZE = 10

// FilterMultiSelect's encoding: [] = no filter, [FILTER_NONE] = nothing ticked — which matches no row.
const matchesFilter = (values: string[], value: string | number) =>
  values.length === 0 || values.includes(String(value))

type PropsT = {
  drafts: ExpenseDraftRowT[]
  canSend: boolean
  investments: WorkerStageInvestmentT[]
  registers: CashRegisterRefT[]
}

export function WorkerExpenseDraftsTable({ drafts, canSend, investments, registers }: PropsT) {
  const { t } = useTranslation('expenseDrafts')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [investmentFilter, setInvestmentFilter] = useState<string[]>([])
  // Only a pending draft can be edited or deleted, so with none waiting the column would stand empty.
  const hasActions = canSend && drafts.some((draft) => draft.status === 'pending')
  const columns = useExpenseDraftColumns({
    isManagerView: false,
    canEditPages: canSend,
    actions: hasActions
      ? (draft) =>
          draft.status === 'pending' && (
            <>
              <ExpenseDraftDialog investments={investments} registers={registers} draft={draft} />
              <DeleteExpenseDraftButton draftId={draft.id} investmentName={draft.investmentName} />
            </>
          )
      : undefined,
  })

  // Off the drafts, not the props' `investments`: those are where he may send today, and his history
  // also holds investments he has since left.
  const investmentOptions = [
    ...new Map(drafts.map((draft) => [draft.investmentId, draft.investmentName])),
  ]
    .map(([id, name]) => ({ value: String(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const filtered = drafts.filter(
    (draft) =>
      matchesFilter(statusFilter, draft.status) &&
      matchesFilter(investmentFilter, draft.investmentId),
  )
  const totalPages = Math.ceil(filtered.length / pageSize)
  // A delete can shrink the list under the page the worker is on.
  const currentPage = Math.min(page, Math.max(1, totalPages))

  // Any change to what is listed starts over from page 1, as the URL-driven tables do.
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
