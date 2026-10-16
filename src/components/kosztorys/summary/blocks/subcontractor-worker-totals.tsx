'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SettlePayoutsDialog } from '@/components/dialogs/settle-payouts-dialog'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { OptionalLink } from '@/components/ui/optional-link'
import { formatNet } from '@/lib/kosztorys/format'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { workerKey } from '@/lib/kosztorys/worker-key'
import { subcontractorRowTotals } from '@/lib/kosztorys/subcontractor-summary'
import type {
  SubcontractorWorkerRowT,
  WorkerSettlementStateT,
} from '@/lib/kosztorys/subcontractor-summary'

// `no_executed_work` is an ordinary prepayment and must stay quiet or it cries wolf on every advance.
const STATE_QUALIFIER: Record<
  WorkerSettlementStateT,
  { text: string; tone: 'muted' | 'error' } | null
> = {
  settled: null,
  overpaid: { text: 'Wypłacono więcej niż wykonano', tone: 'error' },
  no_stages: { text: 'Brak przypisanych etapów', tone: 'error' },
  no_executed_work: { text: 'Przypisane etapy bez wykonanych prac', tone: 'muted' },
  unattributed: null,
}

function RemainingCell({ amount, weight }: { amount: number; weight?: 'medium' | 'bold' }) {
  const isNegative = amount < 0
  return (
    <SummaryValueCell
      tone={isNegative ? 'error' : 'default'}
      weight={weight}
      note={isNegative ? { text: 'nadpłacone', tone: 'error' } : undefined}
    >
      {formatNet(amount)}
    </SummaryValueCell>
  )
}

export function SubcontractorWorkerTotals({
  investmentId,
  investmentName,
  rows,
}: {
  investmentId: number
  investmentName: string
  rows: SubcontractorWorkerRowT[]
}) {
  const [isSettleOpen, setIsSettleOpen] = useState(false)
  const totals = subcontractorRowTotals(rows)
  const hasOpenPair = rows.some((row) => row.workerId !== null && row.remaining !== 0)
  const showBonus = rows.some((row) => row.bonus !== 0)
  const valueCols = Array.from({ length: showBonus ? 4 : 3 }, () => SUMMARY_VALUE_COL).join(' ')

  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${valueCols}`} className="h-fit w-fit">
      <SummaryHeaderCell variant="label" className="flex items-center justify-between gap-2">
        <span>Podsumowanie pracowników</span>
        {hasOpenPair && (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsSettleOpen(true)}>
            Rozlicz wypłaty
          </Button>
        )}
      </SummaryHeaderCell>
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.due}</SummaryHeaderCell>
      {showBonus && <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.bonus}</SummaryHeaderCell>}
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.payouts}</SummaryHeaderCell>
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.remaining}</SummaryHeaderCell>

      {rows.map((row) => {
        const qualifier = STATE_QUALIFIER[row.state]
        return (
          <div key={workerKey(row.workerId)} className="contents">
            <SummaryLabelCell weight="medium" note={qualifier}>
              <OptionalLink
                href={
                  row.workerId === null
                    ? undefined
                    : investmentTransfersHref(investmentId, {
                        types: ['PAYOUT', 'BONUS'],
                        worker: row.workerId,
                      })
                }
              >
                {row.name}
              </OptionalLink>
            </SummaryLabelCell>
            <SummaryValueCell>{formatNet(row.due)}</SummaryValueCell>
            {showBonus && <SummaryValueCell>{formatNet(row.bonus)}</SummaryValueCell>}
            <SummaryValueCell tone="success" weight="medium">
              {formatNet(row.paid)}
            </SummaryValueCell>
            <RemainingCell amount={row.remaining} weight="medium" />
          </div>
        )
      })}

      <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
      <SummaryValueCell weight="bold">{formatNet(totals.due)}</SummaryValueCell>
      {showBonus && <SummaryValueCell weight="bold">{formatNet(totals.bonus)}</SummaryValueCell>}
      <SummaryValueCell tone="success" weight="bold">
        {formatNet(totals.paid)}
      </SummaryValueCell>
      <RemainingCell amount={totals.remaining} weight="bold" />
      <SettlePayoutsDialog
        target={
          isSettleOpen ? { kind: 'investment', id: investmentId, name: investmentName } : null
        }
        onClose={() => setIsSettleOpen(false)}
      />
    </SummaryTable>
  )
}
