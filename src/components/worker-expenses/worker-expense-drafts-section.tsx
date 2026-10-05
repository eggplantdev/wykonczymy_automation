import { Description } from '@/components/ui/description'
import { AddExpenseDraftDialog } from '@/components/worker-expenses/add-expense-draft-dialog'
import { DeleteExpenseDraftButton } from '@/components/worker-expenses/delete-expense-draft-button'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'
import { formatPLDateTime } from '@/lib/utils/format-date'

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
  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Moje wydatki</h2>
        {canSend && registers.length > 0 && investments.length > 0 && (
          <AddExpenseDraftDialog
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
        <ul className="flex flex-col divide-y rounded-md border text-sm">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium">{draft.investmentName}</div>
                <div className="text-muted-foreground text-xs">
                  {formatPLDateTime(draft.sentAt)} · zdjęć: {draft.media.length}
                </div>
                {draft.note && <div className="mt-1 break-words">{draft.note}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DraftStatusBadge status={draft.status} />
                {canSend && draft.status === 'pending' && (
                  <DeleteExpenseDraftButton
                    draftId={draft.id}
                    investmentName={draft.investmentName}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
