'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { ReportGrid } from '@/components/kosztorys/worker-report/report-grid'
import { POZYCJA_FORMS, type SentT } from '@/components/kosztorys/worker-report/send-bar'
import { SentReports } from '@/components/kosztorys/worker-report/sent-reports'
import {
  reportDraftKey,
  useReportDraft,
} from '@/components/kosztorys/worker-report/use-report-draft'
import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import type { WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { pluralize } from '@/lib/utils/polish-plural'

type PropsT = {
  token: string
  data: WorkerReportFormDataT
  document: Extract<WorkerKosztorysT, { kind: 'ready' }>
  pendingQtyByItem: Record<number, number>
  sentReports: WorkerReportRowT[]
}

export function WorkerReportForm({ token, data, document, pendingQtyByItem, sentReports }: PropsT) {
  const router = useRouter()
  const [sent, setSent] = useState<SentT | undefined>()
  const [liveItemIds] = useState(
    () => new Set(data.sections.flatMap((section) => section.items.map((item) => item.id))),
  )
  const draft = useReportDraft(reportDraftKey(data.investmentId, data.workerId), liveItemIds)

  if (sent) {
    return (
      <main className="worker-report mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
        <BrandedHeader data={data} />
        <div className="flex flex-col items-start gap-4 px-4 py-10">
          <h2 className="text-lg font-semibold">Wysłano do weryfikacji</h2>
          <p className="text-muted-foreground text-sm">
            {sent.lineCount} {pluralize(sent.lineCount, POZYCJA_FORMS)}. Kierownik sprawdzi
            zgłoszenie i przeniesie je do etapu w rozpisce.
          </p>
          <Button variant="outline" onClick={() => setSent(undefined)}>
            Nowe zgłoszenie
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
      onSent={(next) => {
        setSent(next)
        // Re-reads his sent list and „Czeka” for the confirmation screen and the next report.
        router.refresh()
      }}
    />
  )
}
