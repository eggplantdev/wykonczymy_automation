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
import { PLANE_LABELS, SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import type { SubcontractorSummaryT } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'

const UNCONFIRMED_PLANE_HINT =
  'Niektóre etapy nie mają potwierdzonego rozliczenia — nie wchodzą do żadnej z kwot, więc suma jest niższa niż faktycznie wykonana praca.'

// One „Kwota" column throughout, no netto/brutto axis (EX-558: subcontractors are paid without VAT).
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
      <SummaryHeaderCell variant="label">Podsumowanie podwykonawców</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {showPlanes && (
        <div className="contents">
          <SummaryLabelCell>{PLANE_LABELS.w_tools}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(due.wTools)}</SummaryValueCell>

          <SummaryLabelCell>{PLANE_LABELS.own_tools}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(due.ownTools)}</SummaryValueCell>
        </div>
      )}

      <SummaryLabelCell
        weight="bold"
        hints={
          due.hasUnconfirmedPlane
            ? [{ variant: 'planeUnconfirmed', content: UNCONFIRMED_PLANE_HINT }]
            : undefined
        }
      >
        {SUBCONTRACTOR_FIGURE_LABELS.due}
      </SummaryLabelCell>
      <SummaryValueCell weight="bold">{formatNet(due.combined)}</SummaryValueCell>

      {summary.bonusTotal !== 0 && (
        <div className="contents">
          <SummaryLabelCell weight="medium">{SUBCONTRACTOR_FIGURE_LABELS.bonus}</SummaryLabelCell>
          <SummaryValueCell weight="medium">{formatNet(summary.bonusTotal)}</SummaryValueCell>
        </div>
      )}

      <SummaryLabelCell weight="medium">{SUBCONTRACTOR_FIGURE_LABELS.payouts}</SummaryLabelCell>
      <SummaryValueCell tone="success" weight="medium">
        {formatNet(summary.payoutsTotal)}
      </SummaryValueCell>

      <SummaryLabelCell weight="bold">{SUBCONTRACTOR_FIGURE_LABELS.remaining}</SummaryLabelCell>
      <SummaryValueCell tone={summary.remaining < 0 ? 'error' : 'default'} weight="bold">
        {formatNet(summary.remaining)}
      </SummaryValueCell>
    </SummaryTable>
  )
}
