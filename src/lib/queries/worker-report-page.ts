import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { listWorkerReports, type WorkerReportRowT } from '@/lib/db/worker-reports'
import { readReportShare } from '@/lib/db/worker-report-share'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'
import type { ReportNoticeKeyT } from '@/lib/kosztorys/worker-report/refusals'
import { reportShareRefusal } from '@/lib/kosztorys/worker-report/share-refusal'
import { WORKER_SCOPE_BLOCK_NOTICE_KEYS } from '@/lib/kosztorys/worker-view/labels'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import {
  getWorkerKosztorysByReportShare,
  getWorkerKosztorysPreview,
} from '@/lib/queries/worker-kosztorys'
import { getSectionTranslations } from '@/lib/queries/section-translations'

// The page's opening language, before the worker's own switcher choice is read on the device.
type ReportLocaleT = { language: LanguageT; workerId: number }

export type WorkerReportPageT = ReportLocaleT &
  (
    | { kind: 'notice'; investmentName: string; workerName: string; messageKey: ReportNoticeKeyT }
    | {
        kind: 'ready'
        document: Extract<WorkerKosztorysT, { kind: 'ready' }>
        sentReports: WorkerReportRowT[]
        sectionTranslations: SectionTranslationMapT
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

  return assembleReportPage(db, locale, share.investmentId, getWorkerKosztorysByReportShare(share))
}

/**
 * The owner's „Podgląd pracownika": the worker's page by ids, behind the session. It reads no share,
 * so it previews a worker whose link was never generated, revoked or refused, exactly as he would
 * see it once the link works.
 */
export async function getWorkerReportPreview(
  investmentId: number,
  workerId: number,
): Promise<WorkerReportPageT | null> {
  // Awaited alone: it is the management guard, and nothing else is read before it passes.
  const document = await getWorkerKosztorysPreview(investmentId, workerId)
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  return assembleReportPage(db, { language: DEFAULT_LANGUAGE, workerId }, investmentId, document)
}

async function assembleReportPage(
  db: DbExecutorT,
  locale: ReportLocaleT,
  investmentId: number,
  documentRead: Promise<WorkerKosztorysT | null> | WorkerKosztorysT | null,
): Promise<WorkerReportPageT | null> {
  const [document, sentReports, sectionTranslations] = await Promise.all([
    documentRead,
    listWorkerReports(db, investmentId, locale.workerId),
    getSectionTranslations(),
  ])
  if (!document) return null
  if (document.kind === 'blocked') {
    return {
      ...locale,
      kind: 'notice',
      investmentName: document.investmentName,
      workerName: document.workerName,
      messageKey: WORKER_SCOPE_BLOCK_NOTICE_KEYS[document.reason],
    }
  }
  return {
    ...locale,
    kind: 'ready',
    document,
    sentReports,
    sectionTranslations,
  }
}
