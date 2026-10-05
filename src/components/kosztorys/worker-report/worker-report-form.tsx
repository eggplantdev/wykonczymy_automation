'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { ReportGrid } from '@/components/kosztorys/worker-report/report-grid'
import type { SentT } from '@/components/kosztorys/worker-report/send-bar'
import { SentReports } from '@/components/kosztorys/worker-report/sent-reports'
import {
  reportDraftKey,
  useReportDraft,
} from '@/components/kosztorys/worker-report/use-report-draft'
import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'
import { useTranslation } from '@/hooks/use-translation'
import { toWorkerReportFormData } from '@/lib/kosztorys/worker-report/to-form-data'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

type PropsT = {
  token?: string
  document: Extract<WorkerKosztorysT, { kind: 'ready' }>
  pendingQtyByItem: Record<number, number>
  sentReports: WorkerReportRowT[]
  sectionTranslations: SectionTranslationMapT
}

export function WorkerReportForm({
  token,
  document,
  pendingQtyByItem,
  sentReports,
  sectionTranslations,
}: PropsT) {
  const data = toWorkerReportFormData(document)
  const router = useRouter()
  const { t, tp } = useTranslation('report')
  const [sent, setSent] = useState<SentT | undefined>()
  const [liveItemIds] = useState(
    () => new Set(data.sections.flatMap((section) => section.items.map((item) => item.id))),
  )
  // The owner's Podgląd keeps its szkic in memory, or what he typed would greet the worker on a shared device.
  const draft = useReportDraft(
    token ? reportDraftKey(data.investmentId, data.workerId) : undefined,
    liveItemIds,
  )

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
        <BrandedHeader data={data} />
        <div className="flex flex-col items-start gap-4 px-4 py-10">
          <h2 className="text-lg font-semibold">{t('sentTitle')}</h2>
          <p className="text-muted-foreground text-sm">{tp('sentBody', sent.lineCount)}</p>
          <Button variant="outline" onClick={() => setSent(undefined)}>
            {t('newReport')}
          </Button>
        </div>
        <SentReports reports={sentReports} />
      </main>
    )
  }

  if (!draft.isLoaded) return null
  return (
    <ReportGrid
      token={token}
      data={data}
      document={document}
      draft={draft}
      pendingQtyByItem={pendingQtyByItem}
      sentReports={sentReports}
      sectionTranslations={sectionTranslations}
      onSent={(next) => {
        setSent(next)
        // Re-reads his sent list and „Czeka” for the confirmation screen and the next report.
        router.refresh()
      }}
    />
  )
}
