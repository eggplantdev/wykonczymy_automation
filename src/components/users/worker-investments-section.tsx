import { Fragment } from 'react'
import {
  SUMMARY_NAME_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'
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
        <SummaryTable
          cols={canReport ? `${SUMMARY_NAME_COL} auto` : SUMMARY_NAME_COL}
          className="w-fit text-sm"
        >
          <SummaryHeaderCell variant="label">{t('investment')}</SummaryHeaderCell>
          {canReport && <SummaryHeaderCell variant="label">{t('reports')}</SummaryHeaderCell>}
          {investments.map((investment) => {
            const reportUrl = investment.token
              ? workerReportShareUrl(FRONTEND_URL, investment.name, workerName, investment.token)
              : undefined
            return (
              <Fragment key={investment.investmentId}>
                <SummaryLabelCell className="flex items-center">
                  <OptionalLink
                    href={canReport && reportUrl ? summaryViewUrl(reportUrl) : undefined}
                  >
                    {investment.name}
                  </OptionalLink>
                </SummaryLabelCell>
                {canReport && (
                  <ReportLinkCell
                    reportUrl={reportUrl}
                    reportWork={t('reportWork')}
                    noLink={t('noLink')}
                  />
                )}
              </Fragment>
            )
          })}
        </SummaryTable>
      )}
    </CollapsibleSection>
  )
}

function ReportLinkCell({
  reportUrl,
  reportWork,
  noLink,
}: {
  reportUrl: string | undefined
  reportWork: string
  noLink: string
}) {
  return (
    <SummaryLabelCell className="flex items-center">
      {reportUrl ? (
        <Button asChild>
          <a href={reportUrl}>{reportWork}</a>
        </Button>
      ) : (
        <span className="text-muted-foreground">{noLink}</span>
      )}
    </SummaryLabelCell>
  )
}
