'use client'

import { useState } from 'react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { PageNav } from '@/components/ui/pagination/page-nav'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'

// The page also pages transfers through the URL, so this table keeps its page in state — two URL-paged
// tables on one page would fight over `page` / `limit`.
const PAGE_SIZE = 10

type PropsT = {
  drafts: ExpenseDraftRowT[]
  canSend: boolean
  investments: WorkerStageInvestmentT[]
  registers: CashRegisterRefT[]
}

export function WorkerExpenseDraftsTable({ drafts, canSend, investments, registers }: PropsT) {
  const [page, setPage] = useState(1)
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

  const totalPages = Math.ceil(drafts.length / PAGE_SIZE)
  // A delete can shrink the list under the page the worker is on.
  const currentPage = Math.min(page, Math.max(1, totalPages))

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={drafts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
        columns={columns}
      />
      <PageNav
        currentPage={currentPage}
        totalPages={totalPages}
        renderPage={(target, isInert, children) => (
          <button type="button" disabled={isInert} onClick={() => setPage(target)}>
            {children}
          </button>
        )}
      />
    </div>
  )
}
