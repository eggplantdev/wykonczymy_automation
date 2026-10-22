'use client'

import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import type { StageBreakdownT } from '@/lib/kosztorys/subcontractor-stage-breakdown'
import { workerKey } from '@/lib/kosztorys/worker-key'

export function SubcontractorStageBreakdown({ breakdown }: { breakdown: StageBreakdownT }) {
  const { workers, rows, totals } = breakdown

  return (
    <SummaryTable
      cols={`${SUMMARY_LABEL_COL} ${Array(workers.length + 1)
        .fill(SUMMARY_VALUE_COL)
        .join(' ')}`}
      className="h-fit w-fit"
    >
      <SummaryHeaderCell>Podział etapów</SummaryHeaderCell>
      <SummaryHeaderCell>Wartość etapu</SummaryHeaderCell>
      {workers.map((worker) => (
        <SummaryHeaderCell key={workerKey(worker.workerId)}>{worker.name}</SummaryHeaderCell>
      ))}

      {rows.map((row) => (
        <div key={row.stageId} className="contents">
          <SummaryCell>{row.label}</SummaryCell>
          <SummaryCell muted>{formatNet(row.wholeNet)}</SummaryCell>
          {row.shares.map((share, column) => (
            <SummaryCell
              key={workerKey(workers[column].workerId)}
              muted={share === null}
              note={share === null ? null : { text: formatPercent(share / row.wholeNet) }}
            >
              {share === null ? '—' : formatNet(share)}
            </SummaryCell>
          ))}
        </div>
      ))}

      <SummaryCell weight="bold">Razem</SummaryCell>
      <SummaryCell muted weight="bold">
        {formatNet(totals.wholeNet)}
      </SummaryCell>
      {totals.shares.map((total, column) => (
        <SummaryCell key={workerKey(workers[column].workerId)} weight="bold">
          {formatNet(total)}
        </SummaryCell>
      ))}
    </SummaryTable>
  )
}
