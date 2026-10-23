'use client'

import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { isNegativeMoney } from '@/lib/utils/round-to-cents'
import { formatNet } from '@/lib/kosztorys/format'
import { PLANE_LABELS, SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import type { SubcontractorSummaryT } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'

const UNCONFIRMED_PLANE_HINT =
  'Niektóre etapy nie mają potwierdzonego rozliczenia — nie wchodzą do żadnej z kwot, więc suma jest niższa niż faktycznie wykonana praca.'

// No netto/brutto axis: subcontractors are paid without VAT.
export function SubcontractorHeadlineSummary({
  summary,
  due,
  showPlanes,
}: {
  summary: SubcontractorSummaryT
  due: SubcontractorDueByPlaneT
  showPlanes: boolean
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
      <SummaryHeaderCell>Podsumowanie podwykonawców</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {showPlanes && (
        <div className="contents">
          <SummaryCell>{PLANE_LABELS.w_tools}</SummaryCell>
          <SummaryCell>{formatNet(due.wTools)}</SummaryCell>

          <SummaryCell>{PLANE_LABELS.own_tools}</SummaryCell>
          <SummaryCell>{formatNet(due.ownTools)}</SummaryCell>
        </div>
      )}

      <SummaryCell
        weight="bold"
        hints={
          due.hasUnconfirmedPlane
            ? [{ variant: 'planeUnconfirmed', content: UNCONFIRMED_PLANE_HINT }]
            : undefined
        }
      >
        {SUBCONTRACTOR_FIGURE_LABELS.due}
      </SummaryCell>
      <SummaryCell weight="bold">{formatNet(due.combined)}</SummaryCell>

      {summary.bonusTotal !== 0 && (
        <div className="contents">
          <SummaryCell weight="medium">{SUBCONTRACTOR_FIGURE_LABELS.bonus}</SummaryCell>
          <SummaryCell weight="medium">{formatNet(summary.bonusTotal)}</SummaryCell>
        </div>
      )}

      <SummaryCell weight="medium">{SUBCONTRACTOR_FIGURE_LABELS.payouts}</SummaryCell>
      <SummaryCell tone="success" weight="medium">
        {formatNet(summary.payoutsTotal)}
      </SummaryCell>

      <SummaryCell weight="bold">{SUBCONTRACTOR_FIGURE_LABELS.remaining}</SummaryCell>
      <SummaryCell tone={isNegativeMoney(summary.remaining) ? 'error' : 'default'} weight="bold">
        {formatNet(summary.remaining)}
      </SummaryCell>
    </SummaryTable>
  )
}
