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
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const COLS = `${SUMMARY_LABEL_COL} auto auto minmax(min(16rem, 40vw), 1fr) auto`

type PropsT = {
  drafts: ExpenseDraftRowT[]
  investments: WorkerStageInvestmentT[]
  /** Only the worker himself sends; a manager on his page sees the list. */
  canSend: boolean
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
  locale: LanguageT
}

export function WorkerExpenseDraftsSection({
  drafts,
  investments,
  canSend,
  registers,
  defaultRegisterId,
  locale,
}: PropsT) {
  const { t } = createTranslator(locale, 'expenseDrafts')
  // Only a pending draft can be edited or deleted, so with none waiting the column would stand empty.
  const showActions = canSend && drafts.some((draft) => draft.status === 'pending')
  // The server refuses an inactive kasa, so offering one only leads to a refusal.
  const sendableRegisters = registers.filter(isActiveRef)

  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        {canSend && sendableRegisters.length > 0 && investments.length > 0 && (
          <ExpenseDraftDialog
            investments={investments}
            registers={sendableRegisters}
            defaultRegisterId={defaultRegisterId}
          />
        )}
      </div>
      {canSend && sendableRegisters.length === 0 && <Description>{t('noRegister')}</Description>}
      {drafts.length === 0 ? (
        <Description>{t('empty')}</Description>
      ) : (
        <SummaryTable cols={showActions ? `${COLS} auto` : COLS}>
          <SummaryHeaderCell variant="label">{t('investment')}</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">{t('sentAt')}</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">{t('attachments')}</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">{t('note')}</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">{t('status')}</SummaryHeaderCell>
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
                        registers={sendableRegisters}
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
