import { Fragment } from 'react'
import { Description } from '@/components/ui/description'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'
import { formatPLDateTime } from '@/lib/utils/format-date'

const COLS = `${SUMMARY_LABEL_COL} auto auto minmax(min(16rem, 40vw), 1fr) auto`

type PropsT = {
  drafts: ExpenseDraftRowT[]
  investments: WorkerStageInvestmentT[]
  /** Only the worker himself sends; a manager on his page sees the list. */
  canSend: boolean
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
}

export function WorkerExpenseDraftsSection({
  drafts,
  investments,
  canSend,
  registers,
  defaultRegisterId,
}: PropsT) {
  // Only a pending draft can be edited or deleted, so with none waiting the column would stand empty.
  const showActions = canSend && drafts.some((draft) => draft.status === 'pending')

  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Moje wydatki</h2>
        {canSend && registers.length > 0 && investments.length > 0 && (
          <ExpenseDraftDialog
            investments={investments}
            registers={registers}
            defaultRegisterId={defaultRegisterId}
          />
        )}
      </div>
      {canSend && registers.length === 0 && (
        <Description>Nie masz kasy — poproś kierownika o jej założenie.</Description>
      )}
      {drafts.length === 0 ? (
        <Description>Brak zgłoszonych wydatków.</Description>
      ) : (
        <SummaryTable cols={showActions ? `${COLS} auto` : COLS}>
          <SummaryHeaderCell variant="label">Inwestycja</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Wysłano</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Załączniki</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Notatka</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Status</SummaryHeaderCell>
          {showActions && <SummaryHeaderCell variant="label">{null}</SummaryHeaderCell>}
          {drafts.map((draft) => (
            <Fragment key={draft.id}>
              <SummaryLabelCell className="flex items-center">
                {draft.investmentName}
              </SummaryLabelCell>
              <SummaryLabelCell className="flex items-center">
                {formatPLDateTime(draft.sentAt)}
              </SummaryLabelCell>
              <SummaryLabelCell className="flex items-center justify-center">
                <ExpenseDraftPagesCell
                  draftId={draft.id}
                  media={draft.media}
                  isEditable={canSend && draft.status === 'pending'}
                />
              </SummaryLabelCell>
              <SummaryLabelCell className="flex items-center break-words">
                {draft.note ?? '—'}
              </SummaryLabelCell>
              <SummaryLabelCell className="flex items-center">
                <DraftStatusBadge status={draft.status} />
              </SummaryLabelCell>
              {showActions && (
                <SummaryLabelCell className="flex items-center gap-1">
                  {draft.status === 'pending' && (
                    <>
                      <ExpenseDraftDialog
                        investments={investments}
                        registers={registers}
                        draft={draft}
                      />
                      <DeleteExpenseDraftButton
                        draftId={draft.id}
                        investmentName={draft.investmentName}
                      />
                    </>
                  )}
                </SummaryLabelCell>
              )}
            </Fragment>
          ))}
        </SummaryTable>
      )}
    </div>
  )
}
