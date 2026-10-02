import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { ReportNotice } from '@/components/kosztorys/worker-report/report-notice'
import { WorkerReportForm } from '@/components/kosztorys/worker-report/worker-report-form'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { translate } from '@/lib/i18n/translations'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import { getWorkerReportPage } from '@/lib/queries/worker-report-page'

type ParamsT = { params: Promise<{ name: string; token: string }> }

const readPage = cache(getWorkerReportPage)

export async function generateMetadata({ params }: ParamsT): Promise<Metadata> {
  const page = await readPage((await params).token)
  return { title: translate(page?.language ?? DEFAULT_LANGUAGE, 'report', 'pageTitle') }
}

// Like /p/<token>, a revoked and a never-issued token share one 404, and the name segment is
// decoration: the token alone resolves.
export default async function WorkerReportPage({ params }: ParamsT) {
  const { token } = await params
  const page = await readPage(token)
  if (!page) notFound()

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
