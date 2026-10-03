import type { DbExecutorT } from '@/lib/db/get-db'
import { investmentGateFor } from '@/lib/db/investment-gate'
import type { ReportShareT } from '@/lib/db/worker-report-share'
import type { ReportRefusalKeyT } from './refusals'

// One order for the page and `tokenAction`, so the page never offers a form whose send is refused.
export async function reportShareRefusal(
  db: DbExecutorT,
  share: ReportShareT,
): Promise<ReportRefusalKeyT | undefined> {
  const gate = await investmentGateFor(db, share.investmentId)
  if (gate.lockMessage) return 'closed'
  if (gate.isTemplate) return 'template'
  if (!share.isWorkerLive) return 'inactiveWorker'
  return undefined
}
