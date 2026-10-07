import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import { ReportWorkButton } from '@/components/users/report-work-button'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { CashRegisterRefT } from '@/types/reference-data'

const ACTION_CLASS = 'h-14 text-base'

type PropsT = {
  investments: WorkerStageInvestmentT[]
  workerName: string
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
  locale: LanguageT
}

export function WorkerQuickActions({
  investments,
  workerName,
  registers,
  defaultRegisterId,
  locale,
}: PropsT) {
  const { t } = createTranslator(locale, 'workerPage')
  // The server refuses an inactive kasa, so offering one only leads to a refusal.
  const sendableRegisters = registers.filter(isActiveRef)
  const reportTargets = investments.flatMap(({ investmentId, name, token }) =>
    token
      ? [
          {
            investmentId,
            name,
            reportUrl: workerReportShareUrl(FRONTEND_URL, name, workerName, token),
          },
        ]
      : [],
  )
  const canAddExpense = sendableRegisters.length > 0 && investments.length > 0
  if (!canAddExpense && reportTargets.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex">
      {canAddExpense && (
        <ExpenseDraftDialog
          investments={investments}
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
