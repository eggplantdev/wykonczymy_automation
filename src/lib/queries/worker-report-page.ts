import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { listWorkerReports, pendingQtyByItem, type WorkerReportRowT } from '@/lib/db/worker-reports'
import { readReportShare } from '@/lib/db/worker-report-share'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'
import type { ReportNoticeKeyT } from '@/lib/kosztorys/worker-report/refusals'
import { reportShareRefusal } from '@/lib/kosztorys/worker-report/share-refusal'
import { WORKER_SCOPE_BLOCK_NOTICE_KEYS } from '@/lib/kosztorys/worker-view/labels'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { getWorkerKosztorysByReportShare } from '@/lib/queries/worker-kosztorys'

// The page's opening language, before the worker's own switcher choice is read on the device.
type ReportLocaleT = { language: LanguageT; workerId: number }

export type WorkerReportPageT = ReportLocaleT &
  (
    | { kind: 'notice'; investmentName: string; workerName: string; messageKey: ReportNoticeKeyT }
    | {
        kind: 'ready'
        document: Extract<WorkerKosztorysT, { kind: 'ready' }>
        // What he sent and nobody has decided yet, per pozycja — so a repeat report shows before he sends it.
        pendingQtyByItem: Record<number, number>
        sentReports: WorkerReportRowT[]
      }
  )

/**
 * The public report page's whole read, uncached: a revoke, a deactivation or a zakończenie must
 * bite on the next load. Null = unknown or revoked token, which the route 404s.
 */
export async function getWorkerReportPage(token: string): Promise<WorkerReportPageT | null> {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const share = await readReportShare(db, token)
  if (!share) return null

  const locale: ReportLocaleT = {
    language: share.language ?? DEFAULT_LANGUAGE,
    workerId: share.workerId,
  }
  const notice = (messageKey: ReportNoticeKeyT): WorkerReportPageT => ({
    ...locale,
    kind: 'notice',
    investmentName: share.investmentName,
    workerName: share.workerName,
    messageKey,
  })

  const refusal = await reportShareRefusal(db, share)
  if (refusal) return notice(refusal)

  const [document, pending, sentReports] = await Promise.all([
    getWorkerKosztorysByReportShare(share),
    pendingQtyByItem(db, share.investmentId, share.workerId),
    listWorkerReports(db, share.investmentId, share.workerId),
  ])
  if (!document) return null
  if (document.kind === 'blocked') return notice(WORKER_SCOPE_BLOCK_NOTICE_KEYS[document.reason])
  return { ...locale, kind: 'ready', document, pendingQtyByItem: pending, sentReports }
}
