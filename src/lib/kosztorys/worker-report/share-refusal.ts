import type { ReportShareT } from '@/lib/db/worker-report-share'
import type { ReportRefusalKeyT } from './refusals'

// One order for the page and `tokenAction`, so the page never offers a form whose send is refused.
export function reportShareRefusal(share: ReportShareT): ReportRefusalKeyT | undefined {
  if (share.lockMessage) return 'closed'
  if (!share.isWorkerLive) return 'inactiveWorker'
  return undefined
}
