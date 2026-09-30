import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { WorkerReportForm } from '@/components/kosztorys/worker-report/worker-report-form'
import { toWorkerReportFormData } from '@/lib/kosztorys/worker-report/to-form-data'
import { getWorkerReportPage } from '@/lib/queries/worker-report'

export const metadata: Metadata = { title: 'Zgłoszenie prac' }

// Like /p/<token>, a revoked and a never-issued token share one 404, and the name segment is
// decoration: the token alone resolves.
export default async function WorkerReportPage({
  params,
}: {
  params: Promise<{ name: string; token: string }>
}) {
  const { token } = await params
  const page = await getWorkerReportPage(token)
  if (!page) notFound()

  if (page.kind === 'notice') {
    return (
      <main className="worker-report mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
        <BrandedHeader data={page} />
        <p className="px-4 py-10 text-sm">{page.message}</p>
      </main>
    )
  }

  return (
    <WorkerReportForm
      token={token}
      data={toWorkerReportFormData(page.document)}
      document={page.document}
      pendingQtyByItem={page.pendingQtyByItem}
      sentReports={page.sentReports}
    />
  )
}
