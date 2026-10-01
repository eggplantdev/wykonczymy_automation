'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { WorkerReportSummaryT } from '@/lib/kosztorys/worker-report/types'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'

type PropsT = { reports: WorkerReportSummaryT[]; onOpen: (reportId: number) => void }

type GroupingT = 'date' | 'worker'

export function WorkerReportsList({ reports, onOpen }: PropsT) {
  const [grouping, setGrouping] = useState<GroupingT>('date')

  if (reports.length === 0) {
    return <p className="text-muted-foreground py-8 text-sm">Brak zgłoszeń wykonanych prac.</p>
  }

  const groups = Map.groupBy(
    reports.toSorted((first, second) => second.sentAt.localeCompare(first.sentAt)),
    (report) => (grouping === 'date' ? formatPLDate(report.sentAt) : report.workerName),
  )

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={grouping === 'date' ? 'secondary' : 'ghost'}
          onClick={() => setGrouping('date')}
        >
          Wg daty
        </Button>
        <Button
          size="sm"
          variant={grouping === 'worker' ? 'secondary' : 'ghost'}
          onClick={() => setGrouping('worker')}
        >
          Wg pracownika
        </Button>
      </div>
      <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-4 overflow-y-auto">
        {[...groups.entries()].map(([groupKey, groupReports]) => (
          <section key={groupKey}>
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
              {groupKey}
            </h3>
            <ul className="divide-border divide-y rounded-md border">
              {groupReports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(report.id)}
                    className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {grouping === 'date' ? report.workerName : formatPLDateTime(report.sentAt)}
                      </span>
                      {report.target && (
                        <span className="text-muted-foreground">
                          {' · do: '}
                          {stageLabel({
                            ordinal: report.target.ordinal,
                            label: report.target.label ?? null,
                          })}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {report.lineCount} {itemNoun(report.lineCount)}
                    </span>
                    <WorkerReportStatusBadge {...report} />
                    <ChevronRight className="text-muted-foreground size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
