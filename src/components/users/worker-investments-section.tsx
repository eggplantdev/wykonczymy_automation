import { Fragment } from 'react'
import { SummaryHeaderCell, SummaryLabelCell, SummaryTable } from '@/components/ui/summary-grid'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const INVESTMENT_COL = 'minmax(min(7rem, 24vw), 28rem)'

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
    <div>
      <h2 className="mb-2 text-sm font-semibold">{t('myInvestments')}</h2>
      {investments.length === 0 ? (
        <Description>{t(canReport ? 'noInvestmentToReport' : 'noInvestments')}</Description>
      ) : (
        <SummaryTable
          cols={canReport ? `${INVESTMENT_COL} auto` : INVESTMENT_COL}
          className="w-fit"
        >
          <SummaryHeaderCell variant="label">{t('investment')}</SummaryHeaderCell>
          {canReport && <SummaryHeaderCell variant="label">{t('reports')}</SummaryHeaderCell>}
          {investments.map((investment) => (
            <Fragment key={investment.investmentId}>
              <SummaryLabelCell className="flex items-center">{investment.name}</SummaryLabelCell>
              {canReport && (
                <ReportLinkCell
                  investment={investment}
                  workerName={workerName}
                  reportWork={t('reportWork')}
                  noLink={t('noLink')}
                />
              )}
            </Fragment>
          ))}
        </SummaryTable>
      )}
    </div>
  )
}

function ReportLinkCell({
  investment,
  workerName,
  reportWork,
  noLink,
}: {
  investment: WorkerStageInvestmentT
  workerName: string
  reportWork: string
  noLink: string
}) {
  return (
    <SummaryLabelCell className="flex items-center">
      {investment.token ? (
        <Button asChild>
          <a
            href={workerReportShareUrl(FRONTEND_URL, investment.name, workerName, investment.token)}
          >
            {reportWork}
          </a>
        </Button>
      ) : (
        <span className="text-muted-foreground">{noLink}</span>
      )}
    </SummaryLabelCell>
  )
}
