import { Description } from '@/components/ui/description'
import { AddExpenseDraftDialog } from '@/components/worker-expenses/add-expense-draft-dialog'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLDateTime } from '@/lib/utils/format-date'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  investments: WorkerStageInvestmentT[]
  /** Only the worker himself sends; a manager on his page sees the list. */
  canSend: boolean
  hasDefaultRegister: boolean
}

export function WorkerExpenseDraftsSection({
  drafts,
  investments,
  canSend,
  hasDefaultRegister,
}: PropsT) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Moje wydatki</h2>
        {canSend && hasDefaultRegister && investments.length > 0 && (
          <AddExpenseDraftDialog investments={investments} />
        )}
      </div>
      {canSend && !hasDefaultRegister && (
        <Description>Nie masz domyślnej kasy — poproś kierownika o jej ustawienie.</Description>
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
              <DraftStatusBadge status={draft.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
