import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { investmentGateFor } from '@/lib/db/investment-gate'
import {
  listWorkerReportsForWorker,
  pendingQtyByItem,
  readReportShare,
  type WorkerReportRowT,
} from '@/lib/db/worker-reports'
import { REPORT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { getWorkerKosztorysByReportToken } from '@/lib/queries/worker-kosztorys'

export type WorkerReportPageT =
  | { kind: 'notice'; investmentName: string; workerName: string; message: string }
  | {
      kind: 'ready'
      document: Extract<WorkerKosztorysT, { kind: 'ready' }>
      // What he sent and nobody has decided yet, per pozycja — so a repeat report shows before he sends it.
      pendingQtyByItem: Record<number, number>
      sentReports: WorkerReportRowT[]
    }

/**
 * The public report page's whole read, uncached: a revoke, a deactivation or a zakończenie must
 * bite on the next load. The checks run in `tokenAction`'s order, so the page never offers a form
 * whose send would be refused. Null = unknown or revoked token, which the route 404s.
 */
export async function getWorkerReportPage(token: string): Promise<WorkerReportPageT | null> {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const share = await readReportShare(db, token)
  if (!share) return null

  const notice = (message: string): WorkerReportPageT => ({
    kind: 'notice',
    investmentName: share.investmentName,
    workerName: share.workerName,
    message,
  })

  const gate = await investmentGateFor(db, share.investmentId)
  if (gate.lockMessage) return notice(REPORT_REFUSALS.closed)
  if (gate.isTemplate) return notice(REPORT_REFUSALS.template)
  if (!share.isWorkerActive) return notice(REPORT_REFUSALS.inactiveWorker)

  const document = await getWorkerKosztorysByReportToken(token)
  if (!document) return null
  if (document.kind === 'blocked') return notice(WORKER_SCOPE_BLOCK_MESSAGES[document.reason])

  const [pending, sentReports] = await Promise.all([
    pendingQtyByItem(db, share.investmentId, share.workerId),
    listWorkerReportsForWorker(db, share.investmentId, share.workerId),
  ])
  return {
    kind: 'ready',
    document,
    pendingQtyByItem: Object.fromEntries(pending),
    sentReports,
  }
}
