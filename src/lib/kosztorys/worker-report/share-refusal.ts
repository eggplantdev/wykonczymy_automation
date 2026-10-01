import type { DbExecutorT } from '@/lib/db/get-db'
import { investmentGateFor } from '@/lib/db/investment-gate'
import type { ReportShareT } from '@/lib/db/worker-report-share'
import { REPORT_REFUSALS } from './refusals'

// One order for the page and `tokenAction`, so the page never offers a form whose send is refused.
export async function reportShareRefusal(
  db: DbExecutorT,
  share: ReportShareT,
): Promise<string | undefined> {
  const gate = await investmentGateFor(db, share.investmentId)
  if (gate.lockMessage) return REPORT_REFUSALS.closed
  if (gate.isTemplate) return REPORT_REFUSALS.template
  if (!share.isWorkerActive || share.isWorkerTrashed) return REPORT_REFUSALS.inactiveWorker
  return undefined
}
