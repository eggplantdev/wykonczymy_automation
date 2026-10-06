import { WORKER_VIEW_DEFAULT_SETTINGS } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'

export const workerAudience = (summary: Partial<WorkerSummaryT> = {}): WorkerAudienceT => ({
  workerId: 1,
  name: 'Jan',
  plane: 'w_tools',
  settings: WORKER_VIEW_DEFAULT_SETTINGS,
  executedQtyByItem: {},
  summary: {
    plannedNet: 0,
    executedByStage: [],
    stagesWholeNet: 0,
    executedNet: 0,
    bonusNet: 0,
    payouts: [],
    paidNet: 0,
    owed: 0,
    isOverpaid: false,
    ...summary,
  },
})
