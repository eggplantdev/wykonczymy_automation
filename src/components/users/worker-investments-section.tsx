import { ArrowRight } from 'lucide-react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { OptionalLink } from '@/components/ui/optional-link'
import { summaryViewUrl } from '@/lib/kosztorys/worker-view/worker-links'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

export type WorkerInvestmentLinkT = {
  investmentId: number
  name: string
  /** Absent when the investment has no report token yet. */
  reportUrl?: string
}

export function WorkerInvestmentsSection({
  investments,
  canReport,
  locale,
}: {
  investments: WorkerInvestmentLinkT[]
  /** Picks the empty-state wording; the links themselves arrive already gated. */
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
            const summaryUrl = investment.reportUrl && summaryViewUrl(investment.reportUrl)
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
