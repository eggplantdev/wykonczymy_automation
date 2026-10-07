import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { WorkerExpenseDraftsTable } from '@/components/worker-expenses/worker-expense-drafts-table'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  investments: WorkerStageInvestmentT[]
  /** Only the worker himself sends; a manager on his page sees the list. */
  canSend: boolean
  canOpenTransfers: boolean
  sendableRegisters: CashRegisterRefT[]
  locale: LanguageT
}

export function WorkerExpenseDraftsSection({
  drafts,
  investments,
  canSend,
  canOpenTransfers,
  sendableRegisters,
  locale,
}: PropsT) {
  if (drafts.length === 0) return null
  const { t } = createTranslator(locale, 'expenseDrafts')
  return (
    <CollapsibleSection
      title={t('title')}
      hint={t('hint')}
      storageKey="worker:expenseDrafts"
      defaultOpen={false}
      withSeparator={false}
    >
      <WorkerExpenseDraftsTable
        drafts={drafts}
        canSend={canSend}
        canOpenTransfers={canOpenTransfers}
        investments={investments}
        registers={sendableRegisters}
      />
    </CollapsibleSection>
  )
}
