'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { EYEBROW_CLASS } from '@/components/ui/section-header'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils/cn'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { WorkerReportSummaryT } from '@/lib/kosztorys/worker-report/types'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'

type PropsT = { reports: WorkerReportSummaryT[]; onOpen: (reportId: number) => void }

type GroupingT = 'date' | 'worker'

const GROUPING_OPTIONS: OptionT<GroupingT>[] = [
  { value: 'date', label: 'Wg daty' },
  { value: 'worker', label: 'Wg pracownika' },
]

export function WorkerReportsList({ reports, onOpen }: PropsT) {
  const [grouping, setGrouping] = useState<GroupingT>('date')

  if (reports.length === 0) {
    return <EmptyState size="inline" title="Brak zgłoszeń wykonanych prac." />
  }

  const groups = Map.groupBy(
    reports.toSorted((first, second) => second.sentAt.localeCompare(first.sentAt)),
    (report) => (grouping === 'date' ? formatPLDate(report.sentAt) : report.workerName),
  )

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ToggleGroup
        options={GROUPING_OPTIONS}
        value={grouping}
        onChange={setGrouping}
        variant="muted"
      />
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {[...groups.entries()].map(([groupKey, groupReports]) => (
          <section key={groupKey}>
            <h3 className={cn(EYEBROW_CLASS, 'mb-1')}>{groupKey}</h3>
            <ul className={BORDERED_LIST_CLASS}>
              {groupReports.map((report) => (
                <li key={report.id}>
                  <Button
                    variant="ghost"
                    size="listRow"
                    align="start"
                    onClick={() => onOpen(report.id)}
                    className="hover:bg-muted/50 gap-3 py-2.5 text-left"
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
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
