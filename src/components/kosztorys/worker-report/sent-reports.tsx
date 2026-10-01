'use client'

import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'
import { formatPLDateTime } from '@/lib/utils/format-date'

// Newest first comes from the read; this only renders it.
export function SentReports({ reports }: { reports: WorkerReportRowT[] }) {
  const { locale, t, tp } = useTranslation('report')
  if (reports.length === 0) return null

  const statusLabel = (report: WorkerReportRowT): string => {
    if (report.status === 'pending') return t('statusPending')
    if (report.status === 'rejected') return t('statusRejected')
    return t('statusAccepted', { accepted: report.acceptedLineCount, total: report.lineCount })
  }

  return (
    <section className="flex flex-col gap-2 px-4 py-6">
      <h2 className="text-sm font-semibold">{t('sentReports')}</h2>
      <ul className="divide-border flex flex-col divide-y text-sm">
        {reports.map((report) => (
          <li key={report.id} className="flex items-center justify-between gap-4 py-2">
            <span>
              {formatPLDateTime(report.sentAt, locale)} · {report.lineCount}{' '}
              {tp('items', report.lineCount)}
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
