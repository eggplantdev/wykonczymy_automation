'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { WorkerReportSummaryT } from '@/lib/kosztorys/worker-report/types'
import { cn } from '@/lib/utils/cn'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { pluralize } from '@/lib/utils/polish-plural'

type PropsT = { reports: WorkerReportSummaryT[]; onOpen: (reportId: number) => void }

type GroupingT = 'date' | 'worker'

const POZYCJA_FORMS = ['pozycja', 'pozycje', 'pozycji'] as const

const PENDING_TONE = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'

export function WorkerReportsList({ reports, onOpen }: PropsT) {
  const [grouping, setGrouping] = useState<GroupingT>('date')

  if (reports.length === 0) {
    return <p className="text-muted-foreground py-8 text-sm">Brak zgłoszeń prac.</p>
  }

  const groups = new Map<string, WorkerReportSummaryT[]>()
  for (const report of [...reports].sort((a, b) => b.sentAt.localeCompare(a.sentAt))) {
    const groupKey = grouping === 'date' ? formatPLDate(report.sentAt) : report.workerName
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), report])
  }

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
                      {report.lineCount} {pluralize(report.lineCount, POZYCJA_FORMS)}
                    </span>
                    <StatusBadge report={report} />
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

function StatusBadge({ report }: { report: WorkerReportSummaryT }) {
  if (report.status === 'pending') {
    return <span className={cn(BADGE_BASE, PENDING_TONE)}>Do sprawdzenia</span>
  }
  if (report.status === 'rejected') {
    return <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>Odrzucone</span>
  }
  return (
    <span className={cn(BADGE_BASE, BADGE_TONE.positive)}>
      {report.acceptedLineCount === report.lineCount
        ? 'Przyjęte'
        : `Przyjęte ${report.acceptedLineCount} z ${report.lineCount}`}
    </span>
  )
}
