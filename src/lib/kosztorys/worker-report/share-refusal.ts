import type { ReportShareT } from '@/lib/db/worker-report-share'
import type { ReportRefusalKeyT } from './refusals'

export function reportShareRefusal(share: ReportShareT): ReportRefusalKeyT | undefined {
  if (share.lockMessage) return 'closed'
  if (!share.isWorkerLive) return 'inactiveWorker'
  return undefined
}
