'use client'

import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { stageShareLabel, type WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'

// An overpayment is named rather than printed as a minus — „Pozostało do wypłaty −300" reads as a
// debt the firm owes, which is the opposite of what it is.
export function WorkerSummary({ summary }: { summary: WorkerSummaryT }) {
  // Nobody shares his etapy: the whole etap and 100% would only repeat his own amount.
  const hasSharedStage = summary.executedByStage.some((stage) => stage.share)

  return (
    <div className="flex flex-col items-start gap-4">
      <SummaryTable
        cols={
          hasSharedStage
            ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} auto ${SUMMARY_VALUE_COL}`
            : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
        }
        className="h-fit w-fit"
      >
        <SummaryHeaderCell variant="label">Wykonane</SummaryHeaderCell>
        {hasSharedStage && (
          <>
            <SummaryHeaderCell>Wartość etapu</SummaryHeaderCell>
            <SummaryHeaderCell>Twój udział</SummaryHeaderCell>
          </>
        )}
        <SummaryHeaderCell>Kwota netto</SummaryHeaderCell>

        {summary.executedByStage.map((stage) => (
          <div key={stage.stageId} className="contents">
            <SummaryLabelCell>{stage.label}</SummaryLabelCell>
            {hasSharedStage && (
              <>
                <SummaryValueCell muted>{formatNet(stage.wholeNet)}</SummaryValueCell>
                <SummaryValueCell muted>{stageShareLabel(stage)}</SummaryValueCell>
              </>
            )}
            <SummaryValueCell>{formatNet(stage.net)}</SummaryValueCell>
          </div>
        ))}
        <SummaryLabelCell weight="medium">Razem</SummaryLabelCell>
        {hasSharedStage && (
          <>
            <SummaryValueCell muted weight="medium">
              {formatNet(summary.stagesWholeNet)}
            </SummaryValueCell>
            <SummaryValueCell>{null}</SummaryValueCell>
          </>
        )}
        <SummaryValueCell weight="medium">{formatNet(summary.executedNet)}</SummaryValueCell>
      </SummaryTable>

      <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
        <SummaryHeaderCell variant="label">Twoje rozliczenie</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota netto</SummaryHeaderCell>

        <SummaryLabelCell weight="medium">Wykonane razem</SummaryLabelCell>
        <SummaryValueCell weight="medium">{formatNet(summary.executedNet)}</SummaryValueCell>

        <SummaryLabelCell weight="medium">Wypłacone</SummaryLabelCell>
        <SummaryValueCell tone="success" weight="medium">
          {formatNet(summary.paidNet)}
        </SummaryValueCell>

        <SummaryLabelCell weight="bold">
          {summary.isOverpaid ? 'Nadpłata' : 'Pozostało do wypłaty'}
        </SummaryLabelCell>
        <SummaryValueCell weight="bold" tone={summary.isOverpaid ? 'error' : 'default'}>
          {formatNet(Math.abs(summary.owed))}
        </SummaryValueCell>
      </SummaryTable>

      {summary.payouts.length > 0 && (
        <SummaryTable cols={`auto minmax(0, 20rem) ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
          <SummaryHeaderCell variant="label">Wypłaty</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Opis</SummaryHeaderCell>
          <SummaryHeaderCell>Kwota netto</SummaryHeaderCell>

          {summary.payouts.map((payout, index) => (
            <div key={`${payout.date}-${index}`} className="contents">
              <SummaryLabelCell>{formatPLDate(payout.date)}</SummaryLabelCell>
              <SummaryLabelCell muted>{payout.description}</SummaryLabelCell>
              <SummaryValueCell>{formatNet(payout.amount)}</SummaryValueCell>
            </div>
          ))}
          <SummaryLabelCell weight="medium" className="col-span-2">
            Razem
          </SummaryLabelCell>
          <SummaryValueCell weight="medium">{formatNet(summary.paidNet)}</SummaryValueCell>
        </SummaryTable>
      )}
    </div>
  )
}
