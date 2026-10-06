'use client'

import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import { useTranslation } from '@/hooks/use-translation'
import { formatPLDateTime } from '@/lib/utils/format-date'

// Newest first comes from the read; this only renders it.
export function SentReports({ reports }: { reports: WorkerReportRowT[] }) {
  const { locale, t, tp } = useTranslation('report')
  if (reports.length === 0) return null

  return (
    <section className="flex flex-col gap-2 px-4 py-6">
      <h2 className="text-sm font-semibold">{t('sentReports')}</h2>
      <ul className="divide-border flex flex-col divide-y text-sm">
        {reports.map((report) => (
          <li key={report.id} className="py-2">
            {formatPLDateTime(report.sentAt, locale)} · {report.lineCount}{' '}
            {tp('items', report.lineCount)}
          </li>
        ))}
      </ul>
    </section>
  )
}
