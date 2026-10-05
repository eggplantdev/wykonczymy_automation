import { Fragment } from 'react'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { Description } from '@/components/ui/description'
import { INVESTMENT_STATUS_LABELS } from '@/lib/constants/investment-status'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

const COLS = `${SUMMARY_LABEL_COL} auto auto`

export function WorkerKosztorysySection({
  investments,
  workerName,
}: {
  investments: WorkerStageInvestmentT[]
  workerName: string
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Kosztorysy</h2>
      {investments.length === 0 ? (
        <Description>Nie jest przypisany do żadnego etapu.</Description>
      ) : (
        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Inwestycja</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Status</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Zgłoszenia</SummaryHeaderCell>
          {investments.map((investment) => (
            <Fragment key={investment.investmentId}>
              <SummaryLabelCell>{investment.name}</SummaryLabelCell>
              <SummaryLabelCell>{INVESTMENT_STATUS_LABELS[investment.status].pl}</SummaryLabelCell>
              <SummaryLabelCell>
                {investment.token ? (
                  <a
                    href={workerReportShareUrl(
                      FRONTEND_URL,
                      investment.name,
                      workerName,
                      investment.token,
                    )}
                    className="text-primary hover:underline"
                  >
                    Zgłoś prace
                  </a>
                ) : (
                  <span className="text-muted-foreground">brak linku</span>
                )}
              </SummaryLabelCell>
            </Fragment>
          ))}
        </SummaryTable>
      )}
    </div>
  )
}
