import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WorkerReportView } from '@/components/kosztorys/worker-report/worker-report-view'
import { REPORT_VIEWPORT } from '@/components/kosztorys/worker-report/report-viewport'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { translate } from '@/lib/i18n/translations'
import { getWorkerReportPage } from '@/lib/queries/worker-report-page'

type ParamsT = { params: Promise<{ investment: string; name: string; token: string }> }

const readPage = cache(getWorkerReportPage)

export const viewport = REPORT_VIEWPORT

export async function generateMetadata({ params }: ParamsT): Promise<Metadata> {
  const page = await readPage((await params).token)
  return { title: translate(page?.language ?? DEFAULT_LANGUAGE, 'report', 'pageTitle') }
}

// Like the investor's /k/<token>, a revoked and a never-issued token share one 404, and both name
// segments are decoration: the token alone resolves.
export default async function WorkerReportPage({ params }: ParamsT) {
  const { token } = await params
  const page = await readPage(token)
  if (!page) notFound()

  return <WorkerReportView page={page} token={token} />
}
