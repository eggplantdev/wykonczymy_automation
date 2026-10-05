import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { ReportNotice } from '@/components/kosztorys/worker-report/report-notice'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import { WorkerReportForm } from '@/components/kosztorys/worker-report/worker-report-form'
import type { WorkerReportPageT } from '@/lib/queries/worker-report-page'

type PropsT = {
  page: WorkerReportPageT
  token?: string
}

export function WorkerReportView({ page, token }: PropsT) {
  return (
    <TranslationsProvider initialLocale={page.language} workerId={page.workerId}>
      {page.kind === 'notice' ? (
        <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <BrandedHeader data={page} />
          <ReportNotice messageKey={page.messageKey} />
        </main>
      ) : (
        <WorkerReportForm
          token={token}
          document={page.document}
          pendingQtyByItem={page.pendingQtyByItem}
          sentReports={page.sentReports}
          sectionTranslations={page.sectionTranslations}
        />
      )}
    </TranslationsProvider>
  )
}
