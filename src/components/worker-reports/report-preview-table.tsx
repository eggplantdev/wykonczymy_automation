'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { SectionPill } from '@/components/worker-reports/section-pill'
import { WorkerDescription } from '@/components/worker-reports/worker-description'
import { useTranslation } from '@/hooks/use-translation'
import { formatQtyWithUnit } from '@/lib/kosztorys/format'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import type { ReportLineKindT, ReportPreviewLineT } from '@/lib/kosztorys/worker-report/types'
import { cn } from '@/lib/utils/cn'

const col = createColumnHelper<ReportPreviewLineT>()

type PropsT = { group: ReportLineKindT; lines: ReportPreviewLineT[] }

// Read-only, in the builder's order: sekcja order then position, the order the worker sent it in.
export function ReportPreviewTable({ group, lines }: PropsT) {
  const { t } = useTranslation('workerReports')
  const { t: tReport } = useTranslation('report')
  const hasWorkerDescription = lines.some((line) => line.workerDescription !== undefined)

  const columns = [
    col.display({
      id: 'ref',
      header: tReport('formNumber'),
      cell: ({ row: { original: line } }) => (
        <span className="whitespace-nowrap tabular-nums">
          {line.ref !== undefined ? formatFormRef(line.ref) : (line.scannedRef ?? '')}
        </span>
      ),
    }),
    col.accessor('sectionName', {
      header: t('section'),
      enableSorting: false,
      cell: (info) => info.getValue() && <SectionPill name={info.getValue()} />,
    }),
    col.accessor('description', {
      header: t('description'),
      enableSorting: false,
      meta: { fill: true, minWidth: 'min-w-64' },
      cell: (info) => <span className="block leading-snug">{info.getValue()}</span>,
    }),
    ...(hasWorkerDescription
      ? [
          col.accessor('workerDescription', {
            header: t('workerDescription'),
            enableSorting: false,
            meta: { minWidth: 'min-w-64' },
            cell: ({ row: { original: line } }) => (
              <WorkerDescription
                description={line.workerDescription}
                language={line.workerDescriptionLanguage}
              />
            ),
          }),
        ]
      : []),
    col.accessor('reportedQty', {
      header: t('reported'),
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row: { original: line } }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatQtyWithUnit(line.reportedQty, line.unit)}
        </span>
      ),
    }),
    col.display({
      id: 'accepted',
      header: t('accepted'),
      meta: { align: 'right' },
      cell: ({ row: { original: line } }) => {
        const { outcome } = line
        if (outcome.kind === 'accepted') {
          return (
            <span className="whitespace-nowrap tabular-nums">
              {formatQtyWithUnit(outcome.qty, line.unit)}
            </span>
          )
        }
        return (
          <span className="text-muted-foreground">
            {outcome.kind === 'pending' ? t('linePending') : t('lineRejected')}
          </span>
        )
      },
    }),
  ]

  return (
    <DataTable
      data={lines}
      columns={columns}
      storageKey={`worker-report-preview-${group}`}
      getRowClassName={(line) => cn('worker-report-rail', sectionColorRail(line.sectionColor))}
    />
  )
}
