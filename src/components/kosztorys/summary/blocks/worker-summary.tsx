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
import { stageLines, type WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'

// An overpayment is named rather than printed as a minus — „Pozostało do wypłaty −300" reads as a
// debt the firm owes, which is the opposite of what it is.
export function WorkerSummary({ summary }: { summary: WorkerSummaryT }) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
      <SummaryHeaderCell variant="label">Twoje rozliczenie</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota netto</SummaryHeaderCell>

      <SummaryLabelCell>Wartość przedmiaru (Twoja stawka)</SummaryLabelCell>
      <SummaryValueCell>{formatNet(summary.plannedNet)}</SummaryValueCell>

      {summary.executedByStage.flatMap((stage) =>
        stageLines(stage).map((line) => (
          <div key={`${stage.stageId}-${line.label}`} className="contents">
            <SummaryLabelCell muted>{line.label}</SummaryLabelCell>
            <SummaryValueCell muted>{formatNet(line.amount)}</SummaryValueCell>
          </div>
        )),
      )}
      <SummaryLabelCell weight="medium">Wykonane razem</SummaryLabelCell>
      <SummaryValueCell weight="medium">{formatNet(summary.executedNet)}</SummaryValueCell>

      {summary.payouts.map((payout, index) => (
        <div key={`${payout.date}-${index}`} className="contents">
          <SummaryLabelCell muted>{formatPLDate(payout.date)}</SummaryLabelCell>
          <SummaryValueCell muted>{formatNet(payout.amount)}</SummaryValueCell>
        </div>
      ))}
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
  )
}
