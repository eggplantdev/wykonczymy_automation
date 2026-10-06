import { Description } from '@/components/ui/description'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import { WorkerExpenseDraftsTable } from '@/components/worker-expenses/worker-expense-drafts-table'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

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
  // The server refuses an inactive kasa, so offering one only leads to a refusal.
  const sendableRegisters = registers.filter(isActiveRef)

  return (
    <CollapsibleSection
      className="max-w-4xl"
      title={t('title')}
      hint={t('hint')}
      storageKey="worker:expenseDrafts"
      withSeparator={false}
      action={
        canSend &&
        sendableRegisters.length > 0 &&
        investments.length > 0 && (
          <ExpenseDraftDialog
            investments={investments}
            registers={sendableRegisters}
            defaultRegisterId={defaultRegisterId}
          />
        )
      }
    >
      {canSend && sendableRegisters.length === 0 && <Description>{t('noRegister')}</Description>}
      {canSend && investments.length === 0 && <Description>{t('noInvestment')}</Description>}
      {drafts.length === 0 ? (
        <Description>{t('empty')}</Description>
      ) : (
        <WorkerExpenseDraftsTable
          drafts={drafts}
          canSend={canSend}
          investments={investments}
          registers={sendableRegisters}
        />
      )}
    </CollapsibleSection>
  )
}
