import { Fragment } from 'react'
import { SummaryHeaderCell, SummaryLabelCell, SummaryTable } from '@/components/ui/summary-grid'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

const COLS = 'minmax(min(7rem, 24vw), 28rem) auto'

export function WorkerInvestmentsSection({
  investments,
  workerName,
}: {
  investments: WorkerStageInvestmentT[]
  workerName: string
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Moje inwestycje</h2>
      {investments.length === 0 ? (
        <Description>Brak aktywnych inwestycji.</Description>
      ) : (
        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Inwestycja</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Zgłoszenia</SummaryHeaderCell>
          {investments.map((investment) => (
            <Fragment key={investment.investmentId}>
              <SummaryLabelCell>{investment.name}</SummaryLabelCell>
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
                      Zgłoś prace
                    </a>
                  </Button>
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
