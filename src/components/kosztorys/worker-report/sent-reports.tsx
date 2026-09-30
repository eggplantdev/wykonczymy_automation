import { itemNoun } from '@/lib/kosztorys/counted-nouns'
import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import { cn } from '@/lib/utils/cn'
import { formatPLDateTime } from '@/lib/utils/format-date'

function statusLabel(report: WorkerReportRowT): string {
  if (report.status === 'pending') return 'czeka'
  if (report.status === 'rejected') return 'odrzucone'
  return `przyjęte (${report.acceptedLineCount} z ${report.lineCount})`
}

// Newest first comes from the read; this only renders it.
export function SentReports({ reports }: { reports: WorkerReportRowT[] }) {
  if (reports.length === 0) return null
  return (
    <section className="flex flex-col gap-2 px-4 py-6">
      <h2 className="text-sm font-semibold">Wysłane zgłoszenia</h2>
      <ul className="divide-border flex flex-col divide-y text-sm">
        {reports.map((report) => (
          <li key={report.id} className="flex items-center justify-between gap-4 py-2">
            <span>
              {formatPLDateTime(report.sentAt)} · {report.lineCount} {itemNoun(report.lineCount)}
            </span>
            <span
              className={cn(
                'whitespace-nowrap',
                report.status === 'pending' && 'text-muted-foreground',
                report.status === 'rejected' && 'text-destructive',
              )}
            >
              {statusLabel(report)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
