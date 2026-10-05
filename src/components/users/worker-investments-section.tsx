import { Fragment } from 'react'
import { SummaryHeaderCell, SummaryLabelCell, SummaryTable } from '@/components/ui/summary-grid'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const COLS = 'minmax(min(7rem, 24vw), 28rem) auto'

export function WorkerInvestmentsSection({
  investments,
  workerName,
  locale,
}: {
  investments: WorkerStageInvestmentT[]
  workerName: string
  locale: LanguageT
}) {
  const { t } = createTranslator(locale, 'workerPage')
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{t('myInvestments')}</h2>
      {investments.length === 0 ? (
        <Description>{t('noInvestments')}</Description>
      ) : (
        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">{t('investment')}</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">{t('reports')}</SummaryHeaderCell>
          {investments.map((investment) => (
            <Fragment key={investment.investmentId}>
              <SummaryLabelCell className="flex items-center">{investment.name}</SummaryLabelCell>
              <SummaryLabelCell className="flex items-center">
                {investment.token ? (
                  <Button asChild>
                    <a
                      href={workerReportShareUrl(
                        FRONTEND_URL,
                        investment.name,
                        workerName,
                        investment.token,
                      )}
                    >
                      {t('reportWork')}
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">{t('noLink')}</span>
                )}
              </SummaryLabelCell>
            </Fragment>
          ))}
        </SummaryTable>
      )}
    </div>
  )
}
