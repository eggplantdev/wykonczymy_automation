'use client'

import { useState } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { ClientPagination } from '@/components/ui/pagination/client-pagination'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { useStatusInvestmentFilters } from '@/hooks/use-status-investment-filters'
import { useTranslation } from '@/hooks/use-translation'
import {
  DRAFT_STATUS_LABEL_KEYS,
  EXPENSE_DRAFT_STATUSES,
  NO_INVESTMENT,
} from '@/lib/constants/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'

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
  const newestDraftId = Math.max(0, ...drafts.map((draft) => draft.id))
  const [seenNewestDraftId, setSeenNewestDraftId] = useState(newestDraftId)

  const { filtered, pageRows, setPage, bar, controls } = useStatusInvestmentFilters({
    rows: drafts,
    getStatus,
    getInvestment,
    getInvestmentLabel: (draft) => draft.investmentName ?? t('noInvestment'),
    statusOptions: EXPENSE_DRAFT_STATUSES.map((status) => ({
      value: status,
      label: t(DRAFT_STATUS_LABEL_KEYS[status]),
    })),
    defaultStatus: DEFAULT_STATUS_FILTER,
  })
  // A draft he just sent is listed on page 1 — left on page 3 he would not see it land.
  if (newestDraftId > seenNewestDraftId) {
    setSeenNewestDraftId(newestDraftId)
    setPage(1)
  }
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

  return (
    <div className="flex flex-col gap-3">
      {controls}
      <DataTable data={pageRows} columns={columns} storageKey="worker-expense-drafts" />
      <ClientPagination {...bar} />
    </div>
  )
}
