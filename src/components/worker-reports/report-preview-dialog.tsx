'use client'

import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ReportPreviewTable } from '@/components/worker-reports/report-preview-table'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportLineKindT, ReportPreviewT } from '@/lib/kosztorys/worker-report/types'
import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import { formatPLDateTime } from '@/lib/utils/format-date'

const GROUPS = [
  { kind: 'rozpiska', titleKey: 'groupRozpiska' },
  { kind: 'extra', titleKey: 'groupExtra' },
] as const satisfies { kind: ReportLineKindT; titleKey: string }[]

type PropsT = { preview: ReportPreviewT | undefined; onClose: () => void }

export function ReportPreviewDialog({ preview, onClose }: PropsT) {
  const { t } = useTranslation('workerReports')
  return (
    <Dialog open={preview !== undefined} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-dialog-2xl">
        <DialogHeader title={t('previewTitle')} />
        {preview && <ReportPreviewBody preview={preview} />}
      </DialogContent>
    </Dialog>
  )
}

function ReportPreviewBody({ preview }: { preview: ReportPreviewT }) {
  const { t, locale } = useTranslation('workerReports')
  const { t: tDrafts } = useTranslation('expenseDrafts')
  const decision = preview.decidedAt
    ? [formatPLDateTime(preview.decidedAt, locale), preview.decidedByName]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <div className="worker-report flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">
          {preview.investmentName} · {preview.workerName}
        </span>
        <span className="text-muted-foreground">
          {tDrafts('sentAt')} {formatPLDateTime(preview.sentAt, locale)}
        </span>
        <WorkerReportStatusBadge {...preview} />
        {preview.source === 'scan' && (
          <span className="text-muted-foreground">
            {t('sourceScan')}
            {preview.createdByName && ` · ${t('enteredBy', { name: preview.createdByName })}`}
          </span>
        )}
        {decision && (
          <span className="text-muted-foreground">
            {t('decision')}: {decision}
          </span>
        )}
      </div>

      {preview.photos.length > 0 && (
        <MediaPreviewButton
          files={preview.photos}
          labels={ASSET_PREVIEW_LABELS}
          label={t('photos')}
          className="w-fit"
        />
      )}

      <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
        {GROUPS.map(({ kind, titleKey }) => {
          const lines = preview.lines.filter((line) => line.kind === kind)
          if (lines.length === 0) return null
          return (
            <section key={kind}>
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {t(titleKey)} ({lines.length})
              </h4>
              <ReportPreviewTable group={kind} lines={lines} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
