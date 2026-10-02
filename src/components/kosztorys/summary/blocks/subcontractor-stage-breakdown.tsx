'use client'

import {
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { formatNet, formatPercentPrecise } from '@/lib/kosztorys/format'
import type { StageBreakdownT } from '@/lib/kosztorys/subcontractor-stage-breakdown'
import { workerKey } from '@/lib/kosztorys/worker-key'

export function SubcontractorStageBreakdown({ breakdown }: { breakdown: StageBreakdownT }) {
  const { workers, rows, totals } = breakdown

  return (
    <SummaryTable
      cols={`auto ${Array(workers.length + 1)
        .fill(SUMMARY_VALUE_COL)
        .join(' ')}`}
      className="h-fit w-fit"
    >
      <SummaryHeaderCell variant="label">Podział etapów</SummaryHeaderCell>
      <SummaryHeaderCell>Wartość etapu</SummaryHeaderCell>
      {workers.map((worker) => (
        <SummaryHeaderCell key={workerKey(worker.workerId)}>{worker.name}</SummaryHeaderCell>
      ))}

      {rows.map((row) => (
        <div key={row.stageId} className="contents">
          <SummaryLabelCell>{row.label}</SummaryLabelCell>
          <SummaryValueCell muted>{formatNet(row.wholeNet)}</SummaryValueCell>
          {row.shares.map((share, column) => (
            <SummaryValueCell
              key={workerKey(workers[column].workerId)}
              muted={share === null}
              note={share === null ? null : { text: formatPercentPrecise(share / row.wholeNet) }}
            >
              {share === null ? '—' : formatNet(share)}
            </SummaryValueCell>
          ))}
        </div>
      ))}

      <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
      <SummaryValueCell muted weight="bold">
        {formatNet(totals.wholeNet)}
      </SummaryValueCell>
      {totals.shares.map((total, column) => (
        <SummaryValueCell key={workerKey(workers[column].workerId)} weight="bold">
          {formatNet(total)}
        </SummaryValueCell>
      ))}
    </SummaryTable>
  )
}
