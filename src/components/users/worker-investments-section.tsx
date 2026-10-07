import { ArrowRight } from 'lucide-react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { OptionalLink } from '@/components/ui/optional-link'
import { FRONTEND_URL } from '@/lib/env'
import { summaryViewUrl, workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

export function WorkerInvestmentsSection({
  investments,
  workerName,
  canReport,
  locale,
}: {
  investments: WorkerStageInvestmentT[]
  workerName: string
  /** The link reports as the worker, whoever opens it — so only he is offered it. */
  canReport: boolean
  locale: LanguageT
}) {
  const { t } = createTranslator(locale, 'workerPage')
  return (
    <CollapsibleSection
      title={t('myInvestments')}
      hint={t('myInvestmentsHint')}
      storageKey="worker:investments"
      withSeparator={false}
    >
      {investments.length === 0 ? (
        <Description>{t(canReport ? 'noInvestmentToReport' : 'noInvestments')}</Description>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {investments.map((investment) => {
            const summaryUrl =
              canReport && investment.token
                ? summaryViewUrl(
                    workerReportShareUrl(
                      FRONTEND_URL,
                      investment.name,
                      workerName,
                      investment.token,
                    ),
                  )
                : undefined
            return (
              <li key={investment.investmentId}>
                <OptionalLink href={summaryUrl} className="inline-flex items-center gap-1">
                  {investment.name}
                  {summaryUrl && <ArrowRight className="size-4" />}
                </OptionalLink>
              </li>
            )
          })}
        </ul>
      )}
    </CollapsibleSection>
  )
}
