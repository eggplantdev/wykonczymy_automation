import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import { ReportWorkButton, type ReportTargetT } from '@/components/users/report-work-button'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'
import type { WorkerInvestmentLinkT } from '@/components/users/worker-investments-section'
import type { CashRegisterRefT } from '@/types/reference-data'

// Wraps instead of overflowing: a uk/ru label is wider than half a 390px row.
const ACTION_CLASS = 'h-auto min-h-14 whitespace-normal text-base'

type PropsT = {
  investmentLinks: WorkerInvestmentLinkT[]
  sendableRegisters: CashRegisterRefT[]
  defaultRegisterId?: number
  locale: LanguageT
}

export function WorkerQuickActions({
  investmentLinks,
  sendableRegisters,
  defaultRegisterId,
  locale,
}: PropsT) {
  const { t } = createTranslator(locale, 'workerPage')
  const reportTargets = investmentLinks.filter(
    (link): link is ReportTargetT => link.reportUrl !== undefined,
  )
  const canAddExpense = sendableRegisters.length > 0 && investmentLinks.length > 0
  if (!canAddExpense && reportTargets.length === 0) return null

  return (
    <div className="grid auto-cols-fr grid-flow-col gap-3 sm:flex">
      {canAddExpense && (
        <ExpenseDraftDialog
          investments={investmentLinks}
          registers={sendableRegisters}
          defaultRegisterId={defaultRegisterId}
          triggerClassName={ACTION_CLASS}
        />
      )}
      {reportTargets.length > 0 && (
        <ReportWorkButton
          targets={reportTargets}
          label={t('reportWork')}
          pickerTitle={t('chooseInvestmentToReport')}
          className={ACTION_CLASS}
        />
      )}
    </div>
  )
}
